const express = require('express')
const app = express()
app.use(express.json())
const format = require('date-fns/format')
const isValid = require('date-fns/isValid')
const toDate = require('date-fns/toDate')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const path = require('path')
const dbPath = path.join(__dirname, 'todoApplication.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server is running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(e.message)
  }
}

initializeDBAndServer()

const validateDate = dateString => {
  try {
    const date = new Date(dateString)
    if (isValid(date)) {
      return format(date, 'yyyy-MM-dd')
    } else {
      return null
    }
  } catch (error) {
    return null
  }
}

const checkRequestsQueries = async (request, response, next) => {
  const {search_q, category, priority, status, date} = request.query
  const {todoId} = request.params

  if (category !== undefined) {
    const categoryArray = ['WORK', 'HOME', 'LEARNING']
    if (!categoryArray.includes(category)) {
      response.status(400)
      return response.send('Invalid Todo Category')
    }
    request.category = category
  }

  if (priority !== undefined) {
    const priorityArray = ['HIGH', 'MEDIUM', 'LOW']
    if (!priorityArray.includes(priority)) {
      response.status(400)
      return response.send('Invalid Todo Priority')
    }
    request.priority = priority
  }

  if (status !== undefined) {
    const statusArray = ['TO DO', 'IN PROGRESS', 'DONE']
    if (!statusArray.includes(status)) {
      response.status(400)
      return response.send('Invalid Todo Status')
    }
    request.status = status
  }

  if (date !== undefined) {
    const formattedDate = validateDate(date)
    if (formattedDate === null) {
      response.status(400)
      return response.send('Invalid Due Date')
    }
    request.date = formattedDate
  }

  request.todoId = todoId
  request.search_q = search_q

  next()
}

const checkRequestsBody = async (request, response, next) => {
  const {id, todo, category, priority, status, dueDate} = request.body
  const {todoId} = request.params

  if (category !== undefined) {
    const categoryArray = ['WORK', 'HOME', 'LEARNING']
    if (!categoryArray.includes(category)) {
      response.status(400)
      return response.send('Invalid Todo Category')
    }
    request.category = category
  }

  if (priority !== undefined) {
    const priorityArray = ['HIGH', 'MEDIUM', 'LOW']
    if (!priorityArray.includes(priority)) {
      response.status(400)
      return response.send('Invalid Todo Priority')
    }
    request.priority = priority
  }

  if (status !== undefined) {
    const statusArray = ['TO DO', 'IN PROGRESS', 'DONE']
    if (!statusArray.includes(status)) {
      response.status(400)
      return response.send('Invalid Todo Status')
    }
    request.status = status
  }

  if (dueDate !== undefined) {
    const formattedDate = validateDate(dueDate)
    if (formattedDate === null) {
      response.status(400)
      return response.send('Invalid Due Date')
    }
    request.dueDate = formattedDate
  }

  request.todo = todo
  request.id = id
  request.todoId = todoId

  next()
}

app.get('/todos/', checkRequestsQueries, async (request, response) => {
  const {search_q, category, priority, status, date} = request

  const whereConditions = []
  const params = {}

  if (search_q) {
    whereConditions.push(`todo LIKE '%' || $search_q || '%'`)
    params.$search_q = search_q
  }
  if (category) {
    whereConditions.push(`category = $category`)
    params.$category = category
  }
  if (priority) {
    whereConditions.push(`priority = $priority`)
    params.$priority = priority
  }
  if (status) {
    whereConditions.push(`status = $status`)
    params.$status = status
  }
  if (date) {
    whereConditions.push(`due_date = $dueDate`)
    params.$dueDate = date
  }

  let getTodosQuery = `
    SELECT 
      id,
      todo,
      priority,
      status,
      category,
      due_date AS dueDate 
    FROM 
      todo`

  if (whereConditions.length > 0) {
    getTodosQuery += ` WHERE ${whereConditions.join(' AND ')}`
  }

  try {
    const todosArray = await db.all(getTodosQuery, params)
    response.send(todosArray)
  } catch (error) {
    response.status(500).send('Internal Server Error')
  }
})

app.get('/todos/:todoId', checkRequestsQueries, async (request, response) => {
  const {todoId} = request.params

  const getTodosQuery = `
    SELECT 
      id,
      todo,
      priority,
      status,
      category,
      due_date AS dueDate
    FROM 
      todo
    WHERE 
      id = $todoId;`

  try {
    const todo = await db.get(getTodosQuery, {$todoId: todoId})
    if (todo) {
      response.send(todo)
    } else {
      response.status(404).send('Todo not found')
    }
  } catch (error) {
    response.status(500).send('Internal Server Error')
  }
})

app.get('/agenda/', checkRequestsQueries, async (request, response) => {
  const {date} = request

  const selectDueDateQuery = `
    SELECT
      id,
      todo,
      priority,
      status,
      category,
      due_date AS dueDate
    FROM 
      todo
    WHERE 
      due_date = $date;`

  try {
    const todosArray = await db.all(selectDueDateQuery, {$date: date})
    response.send(todosArray)
  } catch (error) {
    response.status(500).send('Internal Server Error')
  }
})

app.post('/todos/', checkRequestsBody, async (request, response) => {
  const {id, todo, category, priority, status, dueDate} = request.body

  const addTodoQuery = `
    INSERT INTO 
      todo (id, todo, priority, status, category, due_date)
    VALUES
      (
        $id,
        $todo,
        $priority,
        $status,
        $category,
        $dueDate
      );`
  const formatDate = format(new Date(dueDate), 'yyyy-MM-dd')

  try {
    await db.run(addTodoQuery, {
      $id: id,
      $todo: todo,
      $priority: priority,
      $status: status,
      $category: category,
      $dueDate: formatDate,
    })
    response.send('Todo Successfully Added')
  } catch (error) {
    response.status(500).send('Internal Server Error')
  }
})

app.put('/todos/:todoId/', checkRequestsBody, async (request, response) => {
  const {todoId} = request.params
  const {priority, todo, status, category, dueDate} = request.body

  const validFields = ['priority', 'todo', 'status', 'category', 'dueDate']
  const updatedField = validFields.find(
    field => request.body[field] !== undefined,
  )

  if (updatedField) {
    let updateTodoQuery = null
    let message = ''

    switch (updatedField) {
      case 'priority':
        updateTodoQuery = `
          UPDATE
            todo
          SET 
            priority = $priority
          WHERE 
            id = $todoId;`
        message = 'Priority Updated'
        break
      case 'todo':
        updateTodoQuery = `
          UPDATE
            todo
          SET 
            todo = $todo
          WHERE 
            id = $todoId;`
        message = 'Todo Updated'
        break
      case 'status':
        updateTodoQuery = `
          UPDATE
            todo
          SET 
            status = $status
          WHERE 
            id = $todoId;`
        message = 'Status Updated'
        break
      case 'category':
        updateTodoQuery = `
          UPDATE
            todo
          SET 
            category = $category
          WHERE 
            id = $todoId;`
        message = 'Category Updated'
        break
      case 'dueDate':
        updateTodoQuery = `
          UPDATE
            todo
          SET 
            due_date = $dueDate
          WHERE 
            id = $todoId;`
        message = 'Due Date Updated'
        break
    }

    const params = {
      $priority: priority,
      $todo: todo,
      $status: status,
      $category: category,
      $dueDate: dueDate,
      $todoId: todoId,
    }

    try {
      await db.run(updateTodoQuery, params)
      response.send(message)
    } catch (error) {
      response.status(500).send('Internal Server Error')
    }
  } else {
    response.status(400).send('No valid fields found for update')
  }
})

app.delete('/todos/:todoId', async (request, response) => {
  const {todoId} = request.params

  const deleteTodoQuery = `
    DELETE FROM 
      todo
    WHERE 
      id = $todoId;`
  await db.run(deleteTodoQuery, {$todoId: todoId})
  response.send('Todo Deleted')
})

module.exports = app
