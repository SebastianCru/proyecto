const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

require('dotenv').config(); // Cargar variables de entorno

const app = express();

// Configuración de middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'assets')));
app.use(express.static('public'));

// Configuración de vistas EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configuración de la sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'mySecret', // Usa variable de entorno para la clave secreta
    resave: false,
    saveUninitialized: false
}));

// Middleware para pasar la información del usuario a las vistas
app.use((req, res, next) => {
    res.locals.user = req.session.username || null;
    next();
});

// Conexión a la base de datos
const db = mysql.createConnection({
    host: process.env.MYSQLHOST,
    user: process.env.MYSQLUSER,
    password: process.env.MYSQLPASSWORD,
    database: process.env.MYSQLDATABASE,
    port: process.env.MYSQLPORT || 3306
});



db.connect((err) => {
    if (err) {
        console.error('Error al conectar a la base de datos:', err.message);
        process.exit(1);
    }
    console.log('Conectado a la base de datos');
});

// Página principal (index)
app.get('/', (req, res) => {
    res.render('index', {
        title: 'EcoAgua - Inicio',
        description: 'EcoAgua - Conservación y educación para salvar el agua',
        brand: 'EcoAgua',
        headerTitle: 'EcoAgua Educación para Salvar el Agua',
        mainTitle: '¿Por qué EcoAgua?',
        mainContent: 'La necesidad de conservar el agua nunca ha sido tan urgente...',
        year: new Date().getFullYear(),
    });
});

// Página de productos
app.get('/products', (req, res) => {
    const query = 'SELECT * FROM products LIMIT 10';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener productos:', err.message);
            return res.status(500).send('Error en el servidor');
        }
        res.render('products', { products: results });
    });
});

// Ver carrito de compras
app.get('/cart', (req, res) => {
    const cart = req.session.cart || [];
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    res.render('cart', { cart, total, checkoutMessage: null });
});

// Agregar productos al carrito de compras
app.post('/add-to-cart/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const quantity = parseInt(req.body.quantity, 10);
    req.session.cart = req.session.cart || [];

    db.query('SELECT * FROM products WHERE id = ?', [productId], (err, results) => {
        if (err) {
            console.error('Error al obtener el producto:', err.message);
            return res.status(500).send('Error en el servidor');
        }
        const product = results[0];

        const productInCart = req.session.cart.find(item => item.id === productId);
        if (productInCart) {
            productInCart.quantity += quantity;
        } else {
            req.session.cart.push({ ...product, quantity });
        }

        res.redirect('/products');
    });
});

// Eliminar productos del carrito de compras
app.post('/remove-from-cart/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    req.session.cart = (req.session.cart || []).filter(item => item.id !== productId);
    res.redirect('/cart');
});

// Actualizar cantidad de un producto en el carrito de compras
app.post('/update-cart/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    const newQuantity = parseInt(req.body.quantity, 10);

    const productInCart = req.session.cart.find(item => item.id === productId);
    if (productInCart) {
        productInCart.quantity = newQuantity;
    }

    res.redirect('/cart');
});

// Simulación de pago
app.post('/checkout', (req, res) => {
    if (!req.session.user) {
        return res.render('cart', {
            cart: req.session.cart || [],
            total: req.session.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
            checkoutMessage: { type: 'error', text: 'Debes iniciar sesión para proceder al pago.' }
        });
    }

    res.render('cart', {
        cart: req.session.cart || [],
        total: req.session.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        checkoutMessage: { type: 'success', text: 'Pago realizado con éxito.' }
    });
});

// Registro de usuario
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 8);

    db.query('INSERT INTO users SET ?', { username, email, password: hashedPassword }, (err) => {
        if (err) {
            console.error('Error en el registro:', err.message);
            return res.status(500).send('Error en el registro');
        }
        res.redirect('/login');
    });
});

// Inicio de sesión
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], async (err, results) => {
        if (err || results.length === 0) {
            return res.render('login', { error: 'Usuario no encontrado' });
        }
        const user = results[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            req.session.userId = user.id;
            req.session.username = user.username;
            req.session.user = user;
            res.redirect('/');
        } else {
            res.render('login', { error: 'Contraseña incorrecta' });
        }
    });
});

// Cerrar sesión
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error al cerrar sesión:', err.message);
            return res.status(500).send('Error al cerrar sesión');
        }
        res.redirect('/');
    });
});

// Otras páginas
app.get('/contact', (req, res) => {
    res.render('contact');
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.get('/post', (req, res) => {
    res.render('post');
});

// Iniciar servidor
const port = process.env.PORT || 3000; // Usar el puerto proporcionado por Railway
app.listen(port, () => {
    console.log(`Servidor corriendo en el puerto ${port}`);
});
