import jwt from 'jsonwebtoken';
const token = jwt.sign({ id: 1, username: 'admin', role: 'Admin' }, 'super_secret_jwt_key_telecrm');
console.log(token);
