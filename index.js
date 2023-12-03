const express = require('express')
const app = express()
const cors = require('cors')
app.use(cors())
const { connectToDb, getDb } = require("./db")
const http = require('http')
const server = http.createServer(app)
var bodyParser = require('body-parser')
const ws = require('ws')
let db
app.use(bodyParser.urlencoded({ extended: true }))
const { ObjectId } = require('mongodb')
app.use(bodyParser.json())
require('dotenv').config();
const CLIENT_APP = process.env.CLIENT_APP

console.log(CLIENT_APP)
connectToDb((err) => {
    if (!err) {
        app.listen(3000, () => {
            console.log("Server is running on port 3000")
        })

        server.listen(8080, () => {
            console.log("Server is running on port 8080")
        })
        db = getDb()
    }
})

const io = require("socket.io")(server, {
    maxHttpBufferSize: 1e8,
    pingTimeOut: 60000,
    wsEngine: ws.Server,
    cors: {
        origin: [CLIENT_APP, CLIENT_APP + "/creator"],
        methods: ["GET", "POST"]
    }
})
const rooms = {}
const unAnswered = {}
const roomCreators = {}
const messages = {}

io.on("connection", socket => {
    socket.emit("getMe", {
        socketId: socket.id,
        rooms: rooms
    })
    // console.log(socket.id)
    // io.to(socket.id).emit("roomList", rooms)
    socket.on("createRoom", roomId => {
        // console.log(roomId)
        if (!rooms[roomId]) {
            rooms[roomId] = []
            messages[roomId] = []
            socket.join(roomId)
            io.emit("roomList", rooms)
        }
        if (!roomCreators[roomId]) {
            roomCreators[roomId] = socket.id
        }

    })

    socket.on("joinRoom", (roomId) => {
        // console.log(roomId)
        if (!(roomId in rooms)) {

            return;
        }
        if (roomId in rooms) {

            socket.join(roomId)
            if (!(rooms[roomId].includes(socket.id))) rooms[roomId].push(socket.id)

            // io.to(roomCreators[roomId]).emit("newMember",rooms[roomId])
            io.to(roomId).emit("newMember", {
                members: rooms[roomId],
                messages: messages[roomId]
            })
            // if(messages[roomId])io.to(roomId).emit("getMsg", messages[roomId])
        }


        socket.on("disconnect", () => {
            if (socket.id == roomCreators[roomId]) {
                console.log(socket.id, "disconnected!")
                io.to(roomId).emit("clearMembers", [])
                delete rooms[roomId]
                delete messages[roomId];
                db.collection("users")
                    .deleteMany({ roomId: roomId }) 
                return
            }
            rooms[roomId]?.splice(rooms[roomId].indexOf(socket.id), 1)
            // rooms[roomId]?.filter(user => {
            //     return user !== socket.id
            // })
            // console.log(rooms[roomId])
            io.to(roomId).emit("memberLeft", rooms[roomId])
            // io.to(roomCreators[roomId]).emit("memberLeft", rooms[roomId])
            db.collection("users").deleteOne({ socketId: socket.id }, (err, res) => {
                if (err) throw err;
                // Handle response
            });
        })

    })
    // socket.on("startQuiz", (isStartSignal) => {


    //     io.to(isStartSignal.roomId).emit("openQuiz", isStartSignal.isStart)
    // })
    socket.on("sendQuestion", question => {
        // console.log(question)
        // console.log(rooms[question.roomId])
        unAnswered[question.roomId] = rooms[question.roomId]?.length

        // io.to(question.roomId).emit('getUnAnswered', unAnswered[question.roomId])
        // io.to(roomCreators[question.roomId]).emit('getUnAnswered', unAnswered[question.roomId])
        io.to(question.roomId).emit("getQuestion", {
            question: question,
            unAnswered: ["1", "2", "3"],

        })
    })

    socket.on("answeredSignal", signal => { //4 * 2
        // unAnswered[signal.roomId]?.splice(unAnswered[signal.roomId].indexOf(signal.socketId), 1)
        unAnswered[signal.roomId]--;
        if (unAnswered[signal.roomId] == 0) {
            // console.log(unAnswered[signal.roomId])
            io.to(signal.roomId).emit('getUnAnswered', [])
        }
        // io.to(roomCreators[signal.roomId]).emit('getUnAnswered', unAnswered[signal.roomId])
    })
    socket.on("deleteRoom", roomId => {
        // console.log(roomId)
        io.to(roomId).emit("clearMembers", [])
        // io.to(roomCreators[roomId]).emit("clearMembers", [])
        delete rooms[roomId]
        delete messages[roomId];
        db.collection("users")
            .deleteMany({ roomId: roomId })
    })


    socket.on("sendMsg", message => {

        const { dummyMsg, roomId } = message
        messages[roomId] = dummyMsg
        io.to(roomId).emit("getMsg", dummyMsg)
    })
    // socket.on("sendJoinMsg", message =>{
    //     console.log(message)
    //     if(!(message.roomId in messages)) messages[message.roomId] = []
    //     messages[message.roomId].push(message)
    //     io.to(message.roomId).emit("getMsg", messages[message.roomId])

    // })
    socket.on("openScoreboard", signal => {
        const { roomId, isOpen } = signal
        io.to(roomId).emit("getScoreboard", isOpen)
    })
    socket.on("openWinner", signal => {
        const { roomId, isOpenWinner } = signal
        io.to(roomId).emit("getWinner", isOpenWinner)
    })
})

app.post("/users", (req, res) => {
    console.log(req.body)
    db.collection("users")
        .insertOne(req.body)
})
app.get('/users/:socketId', (req, res) => {
    // console.log(req.params.socketId)
    db.collection("users")
        .findOne({ socketId: req.params.socketId })
        .then(doc => {
            res.status(200).json(doc)
        })
        .catch(err => {
            res.status(500).json("Got error!")
        })
})
app.patch('/users/:socketId', (req, res) => {
    // console.log(req.params.socketId)
    // console.log(req.body)
    db.collection("users")
        .updateOne({ socketId: req.params.socketId }, {
            $set: { points: req.body.curPoint }
        })
        .then(doc => {
            res.status(200).json(doc)
        })
        .catch(err => {
            res.status(500).json("Got error!")
        })
})
app.get("/users/:roomId", (req, res) => {
    const users = []
    console.log(req.params.roomId)
    db.collection("users").find({
        roomId: req.params.roomId
    }).toArray()
        .forEach(user => users.push(user))
        .then(() => res.status(200).json(users))
        .catch(err => res.status(500).json(err))

})
let users = []
app.get("/users", (req, res) => {
    db.collection("users").find().toArray()
        .then(doc => {
            users = doc.slice()
            res.status(200).json(doc)
        })
        .catch(err => {
            res.status(500).json("Got error!")
        })
})
app.post('/creators', (req, res) => {
    db.collection("creators").insertOne(req.body)
        .then(doc => {

            res.status(200).json(doc)
        })
        .catch(err => {
            res.status(500).json("Got error!")
        })
})
app.get('/creators/:id', (req, res) => {
    db.collection("creators")
        .findOne({
            _id: new ObjectId(req.params.id)
        })
        .then(user => res.status(200).json(user))
        .catch(err => res.status(500).json(err))
})
app.get('/creators/:email', (req, res) => {
    db.collection("creators")
        .findOne({
            email: req.params.email
        })
        .then(user => res.status(200).json(user))
        .catch(err => res.status(500).json(err))
})
app.get('/creators/:email/:password', (req, res) => {
    db.collection('creators')
        .findOne({
            'email': req.params.email,
            'password': req.params.password
        })
        .then(user => res.status(200).json(user))
        .catch(err => res.status(500).json("Error!"))
})
app.post('/questions', (req, res) => {
    db.collection("questions")
        .insertOne(req.body)
        .then(doc => res.status(200).json(doc))
        .catch(err => res.status(500).json("Error!"))
})
app.get('/questions', (req, res) => {
    db.collection("questions").find().toArray()
        .then(doc => {
            res.status(200).json(doc)
        })
        .catch(err => {
            res.status(500).json("Got error!")
        })
})
app.get('/questions/:colId', (req, res) => {
    const questions = []
    db.collection("questions")
        .find({
            collectionId: req.params.colId
        })
        .forEach(ques => questions.push(ques))
        .then(() => res.status(200).json(questions))
        .catch(err => res.status(500).json(err))
})
app.delete('/questions/:id', (req, res) => {
    db.collection("questions")
        .deleteOne({
            _id: new ObjectId(req.params.id)
        })
        .then((doc) => res.status(200).json(doc))
        .catch(err => res.status(500).json(err))
})
app.post('/collections', (req, res) => {
    db.collection('collections')
        .insertOne(req.body)
        .then(doc => res.status(200).json(doc))
        .catch(err => res.status(500).json("Error!"))
})
app.get('/collections/:userId', (req, res) => {
    const collections = []
    db.collection('collections')
        .find({ userId: req.params.userId })
        .forEach((col) => collections.push(col))
        .then(() => res.status(200).json(collections))
        .catch((err) => res.status(500).json(err))
})
app.patch('/questions/:id', (req, res) => {
    db.collection("questions")
        .updateOne({
            _id: new ObjectId(req.params.id)
        }, {
            $set: {
                query: req.body.query,
                choices: req.body.choices
            }
        })
})
