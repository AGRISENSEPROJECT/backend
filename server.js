require('dotenv').config();


const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const routers=require('./router/router');
app.use(express.json());
app.use("/",routers);
app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
