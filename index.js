const express =require ('express')
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const stripe = require("stripe")(process.env.SECRET_KEY);
const port = process.env.PORT || 5000 ;

// middilewere
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion, ObjectId, Admin } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.0kobzro.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
//     await client.connect();
   
     const userCollection = client.db('bistroDB').collection('users')
     const menuCollection = client.db('bistroDB').collection('menu')
     const reviewCollection = client.db('bistroDB').collection('reviews')
     const cartCollection = client.db('bistroDB').collection('carts')
     const paymentCollection = client.db('bistroDB').collection('payments')
   
//  jwt token create----
app.post('/jwt',async(req,res)=>{
  const user =req.body;
  const token = jwt.sign(user,process.env.ACCESS_TOKEN,{expiresIn:'2hr'})
  res.send({ token })
})

// middileweares verify

const verifyToken =(req,res,next)=>{
  console.log('verify token',req.authorization);
  if(!req.headers.authorization){
    return res.status(401).send({message:'forbidden access'})
  }
  const token = req.headers.authorization.split(' ')[1]
  jwt.verify(token,process.env.ACCESS_TOKEN,function(err,decoded){
    if(err){
      return res.status(401).send({message:'forbidden access'})
    }
    req.decoded =decoded;
     next()
  })
}

// verify admin'
const verifyAdmin = async(req,res,next)=>{
  const email = req.decoded.email;
  const query ={email:email}
  const user = await userCollection.findOne(query)
  const isAdmin = user?.role === 'admin';
  if(!isAdmin){
    return res.status(403).send({message:'forbidden access'})

  }
  next()
}
   
  //  user
  app.get('/users',verifyToken,verifyAdmin,async(req,res)=>{
    console.log('reqheaders', req.headers)
    const result = await userCollection.find().toArray()
    res.send(result)
  })

 app.get('/users/admin/:email', async(req,res)=>{
  const email = req.params.email;
  // if(email !== req.decoded.email){
  //   return res.status(403).send({message:'unathorized access'})
  // }
  console.log('email',email);
  const query ={email:email}
  const user = await userCollection.findOne(query)
  console.log('fkdjfkdfjkd',user);
  let admin = false
  if(user){
    admin =user?.role ==='admin'
  }
  res.send({ admin })
 })


  app.post('/users',async(req,res)=>{
    const user = req.body;
    // if user already exists
    const query = {email:user.email}
    const existing = await userCollection.findOne(query)
    if(existing){
     return res.send({message:'already exists email' , insertedId : null} )
    }
    const result = await userCollection.insertOne(user)
    res.send(result)
  })

  app.patch('/users/admin/:id',verifyToken, verifyAdmin, async(req,res)=>{
    const id = req.params.id;
    const filter ={_id:new ObjectId(id)}
    const updatedDocs ={
      $set:{
        role:'admin'
      }
    }
    const result = await userCollection.updateOne(filter,updatedDocs);
    res.send(result)
  })

  app.delete('/users/:id',verifyToken, verifyAdmin, async(req,res)=>{
    const id = req.params.id;
    const query = {_id: new ObjectId(id)}
    const result = await userCollection.deleteOne(query)
    res.send(result)
  })



     app.get('/menu',async(req,res)=>{
        const result =await menuCollection.find().toArray()
        res.send(result)
     })

     app.post('/menu',verifyToken,verifyAdmin, async(req,res)=>{
      const item = req.body
      const result = await menuCollection.insertOne(item)
      res.send(result)
     })

     app.delete('/menu/:id',verifyToken,verifyAdmin, async(req,res)=>{
      const id = req.params.id;
      const query ={_id: req.params.id}
      const result = await menuCollection.deleteOne(query)
      res.send(result)  
     })

     app.get('/menu/:id',async(req,res)=>{
      const id = req.params.id;
      const query = {_id: req.params.id}
      const result =await menuCollection.findOne(query)
      res.send(result)
     })

     app.patch('/menu/:id',async(req,res)=>{
      const item = req.body;
      const id =req.params.id;
      const query ={_id:req.params.id}
      const updatedDocs ={
        $set:{
          name:item.name,
          category:item.category,
          price:item.price,
          recipe:item.recipe,
          image:item.image
        }
      } 
      const result = await menuCollection.updateOne(query,updatedDocs)
      res.send(result)
     })

    //  app.get('/carts',async(req,res)=>{
    //     const result =await reviewCollection.find().toArray()
    //     res.send(result)
    //  })



    //  cart collection
    app.get('/carts', async(req,res)=>{
      const email = req.query.email;
      const query = {email:email}
      console.log(query);
      const result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/carts',verifyToken,verifyAdmin, async(req,res)=>{
      const cartItem = req.body;
      const result =await cartCollection.insertOne(cartItem)
      res.send(result)
    })

    app.delete('/carts/:id',async(req,res)=>{
      const id = req.params.id
      const query ={_id : new ObjectId(id)}
      const result = await cartCollection.deleteOne(query)
      res.send(result)
    })

    // payment system
    app.post('/create-payment-intent',async(req,res)=>{
      const {price} =req.body;
      const amount = parseInt(price * 100)
      console.log(amount,'amount');

      const paymentIntent = await stripe.paymentIntents.create({
        amount:amount,
        currency:'usd',
        payment_method_types:['card']

      })
      res.send({
        clientSecret:paymentIntent.client_secret
      })
    })
   
    app.get('/payments/:email',verifyToken,async(req,res)=>{
      const query = {email: req.params.email};
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message:'forbidden access'})
      }
      const result = await paymentCollection.find(query).toArray()
      res.send(result)
    })

    app.post('/payments',async(req,res)=>{
      const payment = req.body;
      const result = await paymentCollection.insertOne(payment)
      // carefully delete
      console.log('payment info',payment);
      const query ={_id:{
        $in:payment.cartIds.map(id=>new ObjectId(id))
      }}
      const deletedResult = await cartCollection.deleteMany(query)
      res.send({result,deletedResult})
    })

    // state-analytics
    app.get('/admin-stats', async(req,res)=>{
      const users = await userCollection.estimatedDocumentCount();
      const menuItems = await menuCollection.estimatedDocumentCount()
      const orders =  await paymentCollection.estimatedDocumentCount()
  //  this is the not best way
  // const payments = await paymentCollection.find().toArray()
  // const revinue= payments.reduce((total,payment)=>total + payment.price ,0) verifyAdmin ,verifyToken,
  const result = await paymentCollection.aggregate([
    {
     $group:{
      _id:null,
      totalRevenue:{$sum:'$price'}
     } 
    }
  ]).toArray()
  const revenue = result.length > 0 ? result[0].totalRevenue : 0 
   res.send({
    users,menuItems,orders ,revenue 
   })

    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
//     await client.close();

  }
}
run().catch(console.dir);



app.get('/',(req,res)=>{
    res.send('boss is running')
})
app.listen(port ,()=>{
 console.log(`bistro boss server is running on port${port}`);
})