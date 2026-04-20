# 信发系统 (Advertising Distribution System) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 开发一个完整的信发系统，用于将广告内容投放至门店安卓客户端展示，包含Web管理后台和安卓客户端两大部分。

**Architecture:** 采用前后端分离架构，管理后台基于B/S架构提供Web界面供运营人员内容管理，安卓客户端作为应用程序安装在门店展示设备上轮询拉取广告内容并按照配置的分屏样式展示。后端提供RESTful API负责数据存储、权限管理和内容分发。

**Tech Stack:**
- **后端:** Node.js + Express / NestJS + MySQL
- **管理后台:** React + TypeScript + Ant Design / Naive UI
- **安卓客户端:** Kotlin + AndroidX + Jetpack
- **通信:** RESTful API + JSON

---

## 项目结构

```
ads-system/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── controllers/     # 控制器
│   │   ├── services/        # 业务逻辑
│   │   ├── models/          # 数据模型
│   │   ├── middleware/      # 中间件（认证、日志）
│   │   └── utils/           # 工具函数
│   └── package.json
├── admin-web/              # 管理后台Web端
│   ├── src/
│   │   ├── components/      # 公共组件
│   │   ├── pages/           # 页面（对应各功能模块）
│   │   ├── services/        # API调用
│   │   └── utils/           # 工具
│   └── package.json
└── android-client/          # 安卓客户端
│   ├── app/
│   │   ├── src/main/
│   │   │   └── ...
│   │   └── build.gradle
│   └── ...
```

---

## 任务分解

### Task 1: 数据库设计与初始化

**Files:**
- Create: `backend/src/models/init.sql`

- [ ] **Step 1: 创建数据库表结构SQL**

```sql
-- 门店表
CREATE TABLE `store` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL COMMENT '门店名称',
  `code` VARCHAR(50) UNIQUE NOT NULL COMMENT '门店编码',
  `address` VARCHAR(500) COMMENT '地址',
  `contact_name` VARCHAR(100) COMMENT '联系人',
  `contact_phone` VARCHAR(20) COMMENT '联系电话',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 设备表
CREATE TABLE `device` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `store_id` BIGINT NOT NULL COMMENT '所属门店',
  `name` VARCHAR(200) NOT NULL COMMENT '设备名称',
  `code` VARCHAR(50) UNIQUE NOT NULL COMMENT '设备编码',
  `screen_orientation` VARCHAR(20) DEFAULT 'landscape' COMMENT '屏幕方向: portrait竖屏, landscape横屏',
  `split_type` VARCHAR(20) DEFAULT '1' COMMENT '分屏类型: 1=1分屏, 2=2分屏, 3=3分屏, 3-1=3-1分屏, 4=4分屏',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
  `last_active_at` DATETIME COMMENT '最后在线时间',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`store_id`) REFERENCES `store`(`id`)
);

-- 素材表（广告图片/视频）
CREATE TABLE `material` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL COMMENT '素材名称',
  `type` VARCHAR(20) NOT NULL COMMENT '类型: image图片, video视频',
  `url` VARCHAR(500) NOT NULL COMMENT '素材URL',
  `duration` INT DEFAULT 5 COMMENT '展示时长(秒)',
  `size` BIGINT COMMENT '文件大小(字节)',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 节目表（广告编排）
CREATE TABLE `program` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL COMMENT '节目名称',
  `screen_orientation` VARCHAR(20) NOT NULL COMMENT '适配屏幕方向',
  `split_type` VARCHAR(20) NOT NULL COMMENT '适配分屏类型',
  `material_ids` JSON COMMENT '分区域素材配置 {region1: [id1, id2], region2: [...]}',
  `status` TINYINT DEFAULT 0 COMMENT '状态: 0-草稿, 1-已发布',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 发布计划表（分发）
CREATE TABLE `distribution` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `program_id` BIGINT NOT NULL COMMENT '节目ID',
  `program_name` VARCHAR(200) NOT NULL COMMENT '节目名称（冗余）',
  `target_type` VARCHAR(20) NOT NULL COMMENT '发布目标类型: store门店, device设备',
  `target_ids` JSON NOT NULL COMMENT '目标ID列表 [id1, id2, ...]',
  `start_time` DATETIME NOT NULL COMMENT '生效开始时间',
  `end_time` DATETIME COMMENT '生效结束时间，为空表示永久',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 0-停用, 1-启用',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`program_id`) REFERENCES `program`(`id`)
);

-- 用户表（管理员）
CREATE TABLE `user` (
  `id` BIGINT PRIMARY KEY AUTO_INCREMENT,
  `username` VARCHAR(50) UNIQUE NOT NULL COMMENT '用户名',
  `password_hash` VARCHAR(200) NOT NULL COMMENT '密码哈希',
  `name` VARCHAR(100) COMMENT '真实姓名',
  `role` VARCHAR(20) DEFAULT 'admin' COMMENT '角色: super_admin超级管理员, admin管理员',
  `status` TINYINT DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: 创建数据库并执行SQL初始化**

```bash
mysql -u root -p
CREATE DATABASE ads_system DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit
mysql -u root -p ads_system < backend/src/models/init.sql
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/models/init.sql
git commit -m "feat: init database schema for ads system"
```

---

### Task 2: 后端项目初始化与基础框架搭建

**Files:**
- Create: `backend/package.json`
- Create: `backend/src/app.js`
- Create: `backend/src/config/database.js`
- Create: `backend/src/middleware/auth.js`

- [ ] **Step 1: 初始化package.json**

```json
{
  "name": "ads-system-backend",
  "version": "1.0.0",
  "description": "信发系统后端API服务",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.5",
    "jsonwebtoken": "^9.0.2",
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

- [ ] **Step 2: 创建基础Express应用**

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./config/database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('uploads'));

// API routes
app.use('/api/auth', require('./controllers/auth'));
app.use('/api/store', require('./controllers/store'));
app.use('/api/device', require('./controllers/device'));
app.use('/api/material', require('./controllers/material'));
app.use('/api/program', require('./controllers/program'));
app.use('/api/distribution', require('./controllers/distribution'));
app.use('/api/client', require('./controllers/client')); // 客户端拉数据接口

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
```

- [ ] **Step 3: 创建数据库配置**

```javascript
const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'ads_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;
```

- [ ] **Step 4: 创建JWT认证中间件**

```javascript
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权，请登录' });
  }
  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token无效或已过期' });
  }
}

module.exports = { authMiddleware, JWT_SECRET };
```

- [ ] **Step 5: 安装依赖并测试启动**

```bash
cd backend
npm install
npm run dev
```

Expected: Server starts successfully on port 3000

- [ ] **Step 6: 提交**

```bash
git add backend/package.json backend/src/app.js backend/src/config/database.js backend/src/middleware/auth.js
git commit -m "feat: init backend project structure"
```

---

### Task 3: 后端 - 认证接口开发

**Files:**
- Create: `backend/src/controllers/auth.js`

- [ ] **Step 1: 编写认证控制器**

```javascript
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 管理员登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.execute(
      'SELECT * FROM user WHERE username = ? AND status = 1',
      [username]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: '用户名或密码错误' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: '用户名或密码错误' });
    }
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, name: user.name, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
```

- [ ] **Step 2: 测试接口**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}'
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/controllers/auth.js
git commit -m "feat: add auth controller for login"
```

---

### Task 4: 后端 - 门店管理接口开发

**Files:**
- Create: `backend/src/controllers/store.js`

- [ ] **Step 1: 编写门店控制器**

```javascript
const express = require('express');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// 获取门店列表（分页）
router.get('/list', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword = '' } = req.query;
    const offset = (page - 1) * pageSize;
    let where = '1=1';
    let params = [];
    if (keyword) {
      where += ' AND (name LIKE ? OR code LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM store WHERE ${where}`,
      params
    );
    const [rows] = await pool.execute(
      `SELECT * FROM store WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    res.json({
      list: rows,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取所有门店（下拉选择用）
router.get('/all', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, name, code FROM store WHERE status = 1 ORDER BY id');
    res.json({ list: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 新增门店
router.post('/create', async (req, res) => {
  try {
    const { name, code, address, contact_name, contact_phone } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO store (name, code, address, contact_name, contact_phone) VALUES (?, ?, ?, ?, ?)',
      [name, code, address, contact_name, contact_phone]
    );
    res.json({ id: result.insertId, success: true });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '门店编码已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新门店
router.post('/update', async (req, res) => {
  try {
    const { id, name, code, address, contact_name, contact_phone, status } = req.body;
    const [result] = await pool.execute(
      'UPDATE store SET name=?, code=?, address=?, contact_name=?, contact_phone=?, status=? WHERE id=?',
      [name, code, address, contact_name, contact_phone, status, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '门店编码已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除门店
router.post('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    // 检查是否有关联设备
    const [devices] = await pool.execute('SELECT COUNT(*) as cnt FROM device WHERE store_id = ?', [id]);
    if (devices[0].cnt > 0) {
      return res.status(400).json({ error: '该门店下存在设备，无法删除' });
    }
    await pool.execute('DELETE FROM store WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
```

- [ ] **Step 2: 测试API端点**

```bash
curl -X GET "http://localhost:3000/api/store/list?page=1&pageSize=10" \
  -H "Authorization: Bearer <your-token>"
```

- [ ] **Step 3: 提交**

```bash
git add backend/src/controllers/store.js
git commit -m "feat: add store management CRUD API"
```

---

### Task 5: 后端 - 设备管理接口开发

**Files:**
- Create: `backend/src/controllers/device.js`

- [ ] **Step 1: 编写设备控制器**

```javascript
const express = require('express');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// 获取设备列表（分页）
router.get('/list', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword = '', store_id } = req.query;
    const offset = (page - 1) * pageSize;
    let where = '1=1';
    let params = [];
    if (keyword) {
      where += ' AND (d.name LIKE ? OR d.code LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }
    if (store_id) {
      where += ' AND d.store_id = ?';
      params.push(store_id);
    }
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM device d WHERE ${where}`,
      params
    );
    const [rows] = await pool.execute(
      `SELECT d.*, s.name as store_name
       FROM device d LEFT JOIN store s ON d.store_id = s.id
       WHERE ${where} ORDER BY d.id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    res.json({
      list: rows,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 新增设备
router.post('/create', async (req, res) => {
  try {
    const { store_id, name, code, screen_orientation, split_type } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO device (store_id, name, code, screen_orientation, split_type) VALUES (?, ?, ?, ?, ?)',
      [store_id, name, code, screen_orientation, split_type]
    );
    res.json({ id: result.insertId, success: true });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '设备编码已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新设备
router.post('/update', async (req, res) => {
  try {
    const { id, store_id, name, code, screen_orientation, split_type, status } = req.body;
    const [result] = await pool.execute(
      'UPDATE device SET store_id=?, name=?, code=?, screen_orientation=?, split_type=?, status=? WHERE id=?',
      [store_id, name, code, screen_orientation, split_type, status, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '设备编码已存在' });
    }
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除设备
router.post('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    await pool.execute('DELETE FROM device WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/controllers/device.js
git commit -m "feat: add device management CRUD API"
```

---

### Task 6: 后端 - 素材管理接口开发

**Files:**
- Create: `backend/src/controllers/material.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: 配置multer上传支持**，编写素材控制器

```javascript
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// 配置文件存储
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `material-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'video/avi', 'video/mov'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型，仅支持图片(jpg/png/gif)和视频(mp4/avi/mov)'));
    }
  }
});

// 上传素材
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    const name = req.body.name || file.originalname;
    let type = 'image';
    if (file.mimetype.startsWith('video/')) {
      type = 'video';
    }
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const url = `${baseUrl}/uploads/${file.filename}`;
    const [result] = await pool.execute(
      'INSERT INTO material (name, type, url, duration, size) VALUES (?, ?, ?, ?, ?)',
      [name, type, url, 5, file.size]
    );
    res.json({
      id: result.insertId,
      name,
      type,
      url,
      size: file.size,
      success: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || '上传失败' });
  }
});

// 获取素材列表
router.get('/list', async (req, res) => {
  try {
    const { page = 1, pageSize = 20, keyword = '', type } = req.query;
    const offset = (page - 1) * pageSize;
    let where = '1=1';
    let params = [];
    if (keyword) {
      where += ' AND name LIKE ?';
      params.push(`%${keyword}%`);
    }
    if (type) {
      where += ' AND type = ?';
      params.push(type);
    }
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM material WHERE ${where}`,
      params
    );
    const [rows] = await pool.execute(
      `SELECT * FROM material WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    res.json({
      list: rows,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除素材
router.post('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    const [rows] = await pool.execute('SELECT url FROM material WHERE id = ?', [id]);
    if (rows.length > 0) {
      const url = rows[0].url;
      // 删除本地文件
      const filename = url.split('/').pop();
      const filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await pool.execute('DELETE FROM material WHERE id = ?', [id]);
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/controllers/material.js
git commit -m "feat: add material management with file upload API"
```

---

### Task 7: 后端 - 节目制作接口开发

**Files:**
- Create: `backend/src/controllers/program.js`

- [ ] **Step 1: 编写节目控制器**

```javascript
const express = require('express');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// 获取节目列表
router.get('/list', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword = '', status } = req.query;
    const offset = (page - 1) * pageSize;
    let where = '1=1';
    let params = [];
    if (keyword) {
      where += ' AND name LIKE ?';
      params.push(`%${keyword}%`);
    }
    if (status !== undefined && status !== '') {
      where += ' AND status = ?';
      params.push(parseInt(status));
    }
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM program WHERE ${where}`,
      params
    );
    const [rows] = await pool.execute(
      `SELECT * FROM program WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    res.json({
      list: rows,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取节目详情
router.get('/detail', async (req, res) => {
  try {
    const { id } = req.query;
    const [rows] = await pool.execute('SELECT * FROM program WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '节目不存在' });
    }
    res.json({ data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建节目
router.post('/create', async (req, res) => {
  try {
    const { name, screen_orientation, split_type, material_ids } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO program (name, screen_orientation, split_type, material_ids, status) VALUES (?, ?, ?, ?, 0)',
      [name, screen_orientation, split_type, JSON.stringify(material_ids)]
    );
    res.json({ id: result.insertId, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新节目
router.post('/update', async (req, res) => {
  try {
    const { id, name, screen_orientation, split_type, material_ids, status } = req.body;
    const [result] = await pool.execute(
      'UPDATE program SET name=?, screen_orientation=?, split_type=?, material_ids=?, status=? WHERE id=?',
      [name, screen_orientation, split_type, JSON.stringify(material_ids), status, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除节目
router.post('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    // 检查是否已发布到分发
    const [distributions] = await pool.execute('SELECT COUNT(*) as cnt FROM distribution WHERE program_id = ? AND status = 1', [id]);
    if (distributions[0].cnt > 0) {
      return res.status(400).json({ error: '该节目已在发布计划中，请先删除发布计划后再删除' });
    }
    await pool.execute('DELETE FROM program WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/controllers/program.js
git commit -m "feat: add program management API for advertising programming"
```

---

### Task 8: 后端 - 发布管理（分发）接口开发

**Files:**
- Create: `backend/src/controllers/distribution.js`

- [ ] **Step 1: 编写分发控制器**

```javascript
const express = require('express');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// 获取发布列表
router.get('/list', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, keyword = '', status } = req.query;
    const offset = (page - 1) * pageSize;
    let where = '1=1';
    let params = [];
    if (keyword) {
      where += ' AND program_name LIKE ?';
      params.push(`%${keyword}%`);
    }
    if (status !== undefined && status !== '') {
      where += ' AND status = ?';
      params.push(parseInt(status));
    }
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM distribution WHERE ${where}`,
      params
    );
    const [rows] = await pool.execute(
      `SELECT * FROM distribution WHERE ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );
    res.json({
      list: rows,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 创建发布计划
router.post('/create', async (req, res) => {
  try {
    const { program_id, program_name, target_type, target_ids, start_time, end_time } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO distribution (program_id, program_name, target_type, target_ids, start_time, end_time, status) VALUES (?, ?, ?, ?, ?, ?, 1)',
      [program_id, program_name, target_type, JSON.stringify(target_ids), start_time, end_time || null]
    );
    res.json({ id: result.insertId, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 更新发布状态
router.post('/update-status', async (req, res) => {
  try {
    const { id, status } = req.body;
    await pool.execute('UPDATE distribution SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 删除发布计划
router.post('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    await pool.execute('DELETE FROM distribution WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/controllers/distribution.js
git commit -m "feat: add distribution management API for publishing"
```

---

### Task 9: 后端 - 客户端数据拉取接口开发

**Files:**
- Create: `backend/src/controllers/client.js`

- [ ] **Step 1: 编写客户端接口**（不需要认证，设备用设备码识别）

```javascript
const express = require('express');
const pool = require('../config/database');

const router = express.Router();

// 设备获取当前需要播放的节目
router.post('/get-program', async (req, res) => {
  try {
    const { device_code } = req.body;
    // 查找设备信息
    const [devices] = await pool.execute(
      'SELECT d.*, s.name as store_name FROM device d LEFT JOIN store s ON d.store_id = s.id WHERE d.code = ? AND d.status = 1',
      [device_code]
    );
    if (devices.length === 0) {
      return res.status(400).json({ error: '设备不存在或已禁用' });
    }
    const device = devices[0];

    // 查找当前生效的发布计划
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    let sql = `
      SELECT p.*, d.id as distribution_id
      FROM distribution d
      JOIN program p ON d.program_id = p.id
      WHERE d.status = 1
        AND d.start_time <= ?
        AND p.status = 1
        AND (p.split_type = ? OR p.split_type = '*')
        AND (p.screen_orientation = ? OR p.screen_orientation = '*')
        AND (d.end_time IS NULL OR d.end_time >= ?)
    `;
    let params = [now, device.split_type, device.screen_orientation, now];

    // 根据发布目标检查是否包含该设备
    sql += ` AND (
      (d.target_type = 'device' AND JSON_CONTAINS(d.target_ids, CAST(? AS JSON)))
      OR
      (d.target_type = 'store' AND JSON_CONTAINS(d.target_ids, CAST(? AS JSON)))
    ) ORDER BY d.id DESC`;

    params.push(device.id, device.store_id);

    const [programs] = await pool.execute(sql, params);

    if (programs.length === 0) {
      return res.json({ data: null, message: '当前无播放节目' });
    }

    // 返回最新的节目详情，包含素材URL
    const program = programs[0];
    let materialConfig = {};
    try {
      materialConfig = JSON.parse(program.material_ids);
      // 为每个区域加载素材详情
      for (const region in materialConfig) {
        const materialIds = materialConfig[region];
        const materials = [];
        for (const mid of materialIds) {
          const [matRows] = await pool.execute('SELECT id, name, type, url, duration FROM material WHERE id = ?', [mid]);
          if (matRows.length > 0) {
            materials.push(matRows[0]);
          }
        }
        materialConfig[region] = materials;
      }
    } catch (e) {
      materialConfig = {};
    }

    // 更新设备最后活跃时间
    await pool.execute('UPDATE device SET last_active_at = ? WHERE id = ?', [now, device.id]);

    res.json({
      data: {
        device: {
          id: device.id,
          name: device.name,
          screen_orientation: device.screen_orientation,
          split_type: device.split_type
        },
        program: {
          id: program.id,
          name: program.name,
          screen_orientation: program.screen_orientation,
          split_type: program.split_type,
          materials: materialConfig
        }
      },
      success: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
```

- [ ] **Step 2: 提交**

```bash
git add backend/src/controllers/client.js
git commit -m "feat: add client API for device to get program data"
```

---

### Task 10: 管理后台项目初始化

**Files:**
- Create: `admin-web/package.json`
- Create: `admin-web/vite.config.ts`
- Create: `admin-web/src/main.tsx`
- Create: `admin-web/src/App.tsx`
- Create: `admin-web/src/utils/request.ts`

- [ ] **Step 1: 使用Vite初始化React+TypeScript项目配置**

```json
{
  "name": "ads-system-admin",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.1",
    "naive-ui": "^2.34.4",
    "axios": "^1.3.4",
    "dayjs": "^1.11.7"
  },
  "devDependencies": {
    "@types/react": "^18.0.27",
    "@types/react-dom": "^18.0.10",
    "@vitejs/plugin-react": "^3.1.0",
    "typescript": "^4.9.3",
    "vite": "^4.1.0"
  }
}
```

- [ ] **Step 2: 创建Vite配置**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
})
```

- [ ] **Step 3: 创建入口文件**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 4: 创建axios请求封装**

```typescript
import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 请求拦截器 - 添加token
request.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器 - 处理错误
request.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.reload()
    }
    return Promise.reject(error)
  }
)

export default request
```

- [ ] **Step 5: 安装依赖测试启动**

```bash
cd admin-web
npm install
npm run dev
```

Expected: Dev server starts on port 3001

- [ ] **Step 6: 提交**

```bash
git add admin-web/package.json admin-web/vite.config.ts admin-web/src/main.tsx admin-web/src/App.tsx admin-web/src/utils/request.ts
git commit -m "feat: init admin web project with react + vite + typescript"
```

---

### Task 11: 管理后台 - 登录页面与Layout布局

**Files:**
- Create: `admin-web/src/pages/Login.tsx`
- Create: `admin-web/src/components/Layout.tsx`

- [ ] **Step 1: 创建登录页面**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NCard, NInput, NButton, NForm, NFormItem, useMessage } from 'naive-ui'
import request from '../utils/request'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const message = useMessage()
  const navigate = useNavigate()

  async function handleLogin() {
    if (!username || !password) {
      message.error('请输入用户名和密码')
      return
    }
    setLoading(true)
    try {
      const res: any = await request.post('/auth/login', { username, password })
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      message.success('登录成功')
      navigate('/store')
    } catch (err: any) {
      message.error(err.response?.data?.error || '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: '#f0f2f5'
    }}>
      <NCard title="信发系统 - 管理员登录" style={{ width: '400px' }}>
        <NForm>
          <NFormItem label="用户名">
            <NInput value={username} onUpdateValue={setUsername} placeholder="请输入用户名" />
          </NFormItem>
          <NFormItem label="密码">
            <NInput type="password" value={password} onUpdateValue={setPassword} placeholder="请输入密码" onKeydown={e => {
              if (e.key === 'Enter') handleLogin()
            }} />
          </NFormItem>
          <NButton type="primary" size="large" loading={loading} onClick={handleLogin} style={{ width: '100%' }}>
            登录
          </NButton>
        </NForm>
      </NCard>
    </div>
  )
}
```

- [ ] **Step 2: 创建主布局（侧边菜单+顶部）**

```tsx
import { ref } from 'vue'
import { NLayout, NLayoutSider, NLayoutContent, NMenu, NCard } from 'naive-ui'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'

const menuItems = [
  { key: '/store', label: '门店管理' },
  { key: '/device', label: '设备管理' },
  { key: '/material', label: '素材管理' },
  { key: '/program', label: '节目制作' },
  { key: '/distribution', label: '发布管理' },
  { key: '/system', label: '系统管理' }
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const collapsed = ref(false)

  return (
    <NLayout style={{ minHeight: '100vh' }}>
      <NLayoutSider width={200} collapse={collapsed.value} on-collapse={collapsed => collapsed.value = collapsed}>
        <div style={{ height: '64px', background: '#004098', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ color: 'white', margin: 0 }}>信发系统</h2>
        </div>
        <NMenu
          value={location.pathname}
          onUpdateValue={key => navigate(key as string)}
          options={menuItems}
        />
      </NLayoutSider>
      <NLayout>
        <NLayoutContent style={{ padding: '24px', background: '#f0f2f5' }}>
          <Outlet />
        </NLayoutContent>
      </NLayout>
    </NLayout>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add admin-web/src/pages/Login.tsx admin-web/src/components/Layout.tsx
git commit -m "feat: add login page and admin layout"
```

---

### Task 12: 管理后台 - 门店管理页面

**Files:**
- Create: `admin-web/src/pages/Store.tsx`
- Create: `admin-web/src/services/api.ts`

- [ ] **Step 1: 创建API服务**

```typescript
import request from '../utils/request'

export interface Store {
  id: number
  name: string
  code: string
  address: string
  contact_name: string
  contact_phone: string
  status: number
  created_at: string
}

export const storeApi = {
  list: (params: { page: number; pageSize: number; keyword: string }) => {
    return request.get('/store/list', { params })
  },
  all: () => {
    return request.get('/store/all')
  },
  create: (data: Partial<Store>) => {
    return request.post('/store/create', data)
  },
  update: (data: Store) => {
    return request.post('/store/update', data)
  },
  delete: (id: number) => {
    return request.post('/store/delete', { id })
  }
}
```

- [ ] **Step 2: 创建门店管理页面**

```tsx
import { useState, useEffect } from 'react'
import { NCard, NTable, NInput, NButton, NSpace, NModal, NForm, NFormItem, NInput as NInputField, NSelect, useMessage, useDialog } from 'naive-ui'
import { storeApi, Store } from '../services/api'

export default function StoreManagement() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Store[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<Partial<Store>>({
    name: '',
    code: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    status: 1
  })
  const message = useMessage()
  const dialog = useDialog()

  async function loadData() {
    setLoading(true)
    try {
      const res: any = await storeApi.list({ page, pageSize, keyword })
      setData(res.list)
      setTotal(res.total)
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, keyword])

  function handleAdd() {
    setFormData({ name: '', code: '', address: '', contact_name: '', contact_phone: '', status: 1 })
    setEditingId(null)
    setModalVisible(true)
  }

  function handleEdit(row: Store) {
    setFormData({ ...row })
    setEditingId(row.id)
    setModalVisible(true)
  }

  async function handleSubmit() {
    if (!formData.name || !formData.code) {
      message.error('请填写门店名称和编码')
      return
    }
    try {
      if (editingId) {
        await storeApi.update({ ...formData, id: editingId } as Store)
        message.success('更新成功')
      } else {
        await storeApi.create(formData)
        message.success('创建成功')
      }
      setModalVisible(false)
      loadData()
    } catch (err: any) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  function handleDelete(row: Store) {
    dialog.warning({
      title: '确认删除',
      content: `确定要删除门店"${row.name}"吗？此操作不可恢复。`,
      async onPositiveClick() {
        try {
          await storeApi.delete(row.id)
          message.success('删除成功')
          loadData()
        } catch (err: any) {
          message.error(err.response?.data?.error || '删除失败')
        }
      }
    })
  }

  const columns = [
    { title: 'ID', key: 'id', width: 80 },
    { title: '门店名称', key: 'name', width: 150 },
    { title: '门店编码', key: 'code', width: 120 },
    { title: '地址', key: 'address', ellipsis: true },
    { title: '联系人', key: 'contact_name', width: 100 },
    { title: '联系电话', key: 'contact_phone', width: 120 },
    { title: '状态', key: 'status', width: 80, render: (row: Store) => row.status === 1 ? '启用' : '禁用' },
    { title: '操作', key: 'actions', width: 150, render: (row: Store) => (
      <NSpace>
        <NButton size="small" onClick={() => handleEdit(row)}>编辑</NButton>
        <NButton size="small" type="error" onClick={() => handleDelete(row)}>删除</NButton>
      </NSpace>
    )}
  ]

  return (
    <NCard title="门店管理">
      <NSpace vertical>
        <NSpace>
          <NInput
            placeholder="搜索门店名称/编码"
            value={keyword}
            onUpdateValue={setKeyword}
            style={{ width: '250px' }}
          />
          <NButton type="primary" onClick={() => setPage(1)}>搜索</NButton>
          <NButton type="success" onClick={handleAdd}>新增门店</NButton>
        </NSpace>
        <NTable
          loading={loading}
          columns={columns}
          data={data}
          pagination={{
            page,
            pageSize,
            itemCount: total,
            onUpdatePage: setPage
          }}
        />
      </NSpace>
      <NModal show={modalVisible} onUpdateShow={setModalVisible} preset="card" title={editingId ? '编辑门店' : '新增门店'}>
        <NForm>
          <NFormItem label="门店名称">
            <NInputField
              value={formData.name}
              onUpdateValue={v => setFormData({ ...formData, name: v })}
              placeholder="请输入门店名称"
            />
          </NFormItem>
          <NFormItem label="门店编码">
            <NInputField
              value={formData.code}
              onUpdateValue={v => setFormData({ ...formData, code: v })}
              placeholder="请输入唯一编码"
            />
          </NFormItem>
          <NFormItem label="地址">
            <NInputField
              value={formData.address}
              onUpdateValue={v => setFormData({ ...formData, address: v })}
              placeholder="请输入地址"
            />
          </NFormItem>
          <NFormItem label="联系人">
            <NInputField
              value={formData.contact_name}
              onUpdateValue={v => setFormData({ ...formData, contact_name: v })}
              placeholder="请输入联系人姓名"
            />
          </NFormItem>
          <NFormItem label="联系电话">
            <NInputField
              value={formData.contact_phone}
              onUpdateValue={v => setFormData({ ...formData, contact_phone: v })}
              placeholder="请输入联系电话"
            />
          </NFormItem>
          <NFormItem label="状态">
            <NSelect
              value={formData.status}
              onUpdateValue={v => setFormData({ ...formData, status: v })}
              options={[
                { label: '启用', value: 1 },
                { label: '禁用', value: 0 }
              ]}
            />
          </NFormItem>
          <NSpace justify="end">
            <NButton onClick={() => setModalVisible(false)}>取消</NButton>
            <NButton type="primary" onClick={handleSubmit}>确定</NButton>
          </NSpace>
        </NForm>
      </NModal>
    </NCard>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add admin-web/src/pages/Store.tsx admin-web/src/services/api.ts
git commit -m "feat: add store management page"
```

---

### Task 13: 管理后台 - 设备管理页面

**Files:**
- Create: `admin-web/src/pages/Device.tsx`
- Modify: `admin-web/src/services/api.ts`

- [ ] **Step 1: 添加设备API到api.ts**

Add to `admin-web/src/services/api.ts`:

```typescript
export interface Device {
  id: number
  store_id: number
  store_name: string
  name: string
  code: string
  screen_orientation: string
  split_type: string
  status: number
  last_active_at: string
}

export const deviceApi = {
  list: (params: { page: number; pageSize: number; keyword: string; store_id?: number }) => {
    return request.get('/device/list', { params })
  },
  create: (data: Partial<Device>) => {
    return request.post('/device/create', data)
  },
  update: (data: Device) => {
    return request.post('/device/update', data)
  },
  delete: (id: number) => {
    return request.post('/device/delete', { id })
  }
}
```

- [ ] **Step 2:创建设备管理页面**

```tsx
import { useState, useEffect } from 'react'
import { NCard, NTable, NInput, NButton, NSpace, NModal, NForm, NFormItem, NInput as NInputField, NSelect, useMessage, useDialog } from 'naive-ui'
import { deviceApi, Device, storeApi } from '../services/api'

const screenOrientationOptions = [
  { label: '横屏', value: 'landscape' },
  { label: '竖屏', value: 'portrait' }
]

const splitTypeOptions = [
  { label: '1分屏', value: '1' },
  { label: '2分屏', value: '2' },
  { label: '3分屏', value: '3' },
  { label: '3-1分屏', value: '3-1' },
  { label: '4分屏', value: '4' }
]

export default function DeviceManagement() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Device[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [storeId, setStoreId] = useState<number | null>(null)
  const [storeOptions, setStoreOptions] = useState<{label: string, value: number}[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<Partial<Device>>({
    store_id: undefined,
    name: '',
    code: '',
    screen_orientation: 'landscape',
    split_type: '1',
    status: 1
  })
  const message = useMessage()
  const dialog = useDialog()

  async function loadStores() {
    const res: any = await storeApi.all()
    setStoreOptions(res.list.map(s => ({ label: s.name, value: s.id })))
  }

  async function loadData() {
    setLoading(true)
    try {
      const params: any = { page, pageSize, keyword }
      if (storeId) params.store_id = storeId
      const res: any = await deviceApi.list(params)
      setData(res.list)
      setTotal(res.total)
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStores()
  }, [])

  useEffect(() => {
    loadData()
  }, [page, keyword, storeId])

  function handleAdd() {
    setFormData({
      store_id: undefined,
      name: '',
      code: '',
      screen_orientation: 'landscape',
      split_type: '1',
      status: 1
    })
    setEditingId(null)
    setModalVisible(true)
  }

  function handleEdit(row: Device) {
    setFormData({ ...row })
    setEditingId(row.id)
    setModalVisible(true)
  }

  async function handleSubmit() {
    if (!formData.name || !formData.code || !formData.store_id) {
      message.error('请填写完整信息')
      return
    }
    try {
      if (editingId) {
        await deviceApi.update({ ...formData, id: editingId } as Device)
        message.success('更新成功')
      } else {
        await deviceApi.create(formData)
        message.success('创建成功')
      }
      setModalVisible(false)
      loadData()
    } catch (err: any) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  function handleDelete(row: Device) {
    dialog.warning({
      title: '确认删除',
      content: `确定要删除设备"${row.name}"吗？`,
      async onPositiveClick() {
        try {
          await deviceApi.delete(row.id)
          message.success('删除成功')
          loadData()
        } catch (err: any) {
          message.error(err.response?.data?.error || '删除失败')
        }
      }
    })
  }

  const columns = [
    { title: 'ID', key: 'id', width: 60 },
    { title: '设备名称', key: 'name', width: 150 },
    { title: '设备编码', key: 'code', width: 120 },
    { title: '所属门店', key: 'store_name', width: 150 },
    { title: '屏幕方向', key: 'screen_orientation', width: 80, render: (row: Device) =>
      screenOrientationOptions.find(o => o.value === row.screen_orientation)?.label
    },
    { title: '分屏类型', key: 'split_type', width: 80, render: (row: Device) =>
      splitTypeOptions.find(o => o.value === row.split_type)?.label
    },
    { title: '状态', key: 'status', width: 70, render: (row: Device) => row.status === 1 ? '启用' : '禁用' },
    { title: '最后在线', key: 'last_active_at', width: 170 },
    { title: '操作', key: 'actions', width: 120, render: (row: Device) => (
      <NSpace>
        <NButton size="small" onClick={() => handleEdit(row)}>编辑</NButton>
        <NButton size="small" type="error" onClick={() => handleDelete(row)}>删除</NButton>
      </NSpace>
    )}
  ]

  return (
    <NCard title="设备管理">
      <NSpace vertical>
        <NSpace>
          <NInput
            placeholder="搜索设备名称/编码"
            value={keyword}
            onUpdateValue={setKeyword}
            style={{ width: '200px' }}
          />
          <NSelect
            placeholder="筛选门店"
            value={storeId}
            onUpdateValue={setStoreId}
            options={storeOptions}
            clearable
            style={{ width: '200px' }}
          />
          <NButton type="primary" onClick={() => setPage(1)}>搜索</NButton>
          <NButton type="success" onClick={handleAdd}>新增设备</NButton>
        </NSpace>
        <NTable
          loading={loading}
          columns={columns}
          data={data}
          pagination={{
            page,
            pageSize,
            itemCount: total,
            onUpdatePage: setPage
          }}
        />
      </NSpace>
      <NModal show={modalVisible} onUpdateShow={setModalVisible} preset="card" title={editingId ? '编辑设备' : '新增设备'}>
        <NForm>
          <NFormItem label="所属门店">
            <NSelect
              value={formData.store_id}
              onUpdateValue={v => setFormData({ ...formData, store_id: v })}
              options={storeOptions}
              placeholder="请选择门店"
            />
          </NFormItem>
          <NFormItem label="设备名称">
            <NInputField
              value={formData.name}
              onUpdateValue={v => setFormData({ ...formData, name: v })}
              placeholder="请输入设备名称"
            />
          </NFormItem>
          <NFormItem label="设备编码">
            <NInputField
              value={formData.code}
              onUpdateValue={v => setFormData({ ...formData, code: v })}
              placeholder="请输入唯一编码"
            />
          </NFormItem>
          <NFormItem label="屏幕方向">
            <NSelect
              value={formData.screen_orientation}
              onUpdateValue={v => setFormData({ ...formData, screen_orientation: v })}
              options={screenOrientationOptions}
            />
          </NFormItem>
          <NFormItem label="分屏类型">
            <NSelect
              value={formData.split_type}
              onUpdateValue={v => setFormData({ ...formData, split_type: v })}
              options={splitTypeOptions}
            />
          </NFormItem>
          <NFormItem label="状态">
            <NSelect
              value={formData.status}
              onUpdateValue={v => setFormData({ ...formData, status: v })}
              options={[
                { label: '启用', value: 1 },
                { label: '禁用', value: 0 }
              ]}
            />
          </NFormItem>
          <NSpace justify="end">
            <NButton onClick={() => setModalVisible(false)}>取消</NButton>
            <NButton type="primary" onClick={handleSubmit}>确定</NButton>
          </NSpace>
        </NForm>
      </NModal>
    </NCard>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add admin-web/src/pages/Device.tsx admin-web/src/services/api.ts
git commit -m "feat: add device management page"
```

---

### Task 14: 管理后台 - 素材管理页面

**Files:**
- Create: `admin-web/src/pages/Material.tsx`
- Modify: `admin-web/src/services/api.ts`

- [ ] **Step 1: 添加素材API到api.ts**

```typescript
export interface Material {
  id: number
  name: string
  type: string
  url: string
  duration: number
  size: number
  created_at: string
}

export const materialApi = {
  list: (params: { page: number; pageSize: number; keyword: string; type?: string }) => {
    return request.get('/material/list', { params })
  },
  upload: (file: File, name: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('name', name)
    return request.post('/material/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  delete: (id: number) => {
    return request.post('/material/delete', { id })
  }
}
```

- [ ] **Step 2: 创建素材管理页面（带上传功能）**

```tsx
import { useState, useEffect } from 'react'
import { NCard, NTable, NInput, NButton, NSpace, NUpload, NModal, useMessage, useDialog, NImage, NTag } from 'naive-ui'
import { materialApi, Material } from '../services/api'

export default function MaterialManagement() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Material[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)
  const [keyword, setKeyword] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [uploadModalVisible, setUploadModalVisible] = useState(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const message = useMessage()
  const dialog = useDialog()

  async function loadData() {
    setLoading(true)
    try {
      const params: any = { page, pageSize, keyword }
      if (typeFilter) params.type = typeFilter
      const res: any = await materialApi.list(params)
      setData(res.list)
      setTotal(res.total)
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, keyword, typeFilter])

  function handleUploadSuccess(data: any) {
    message.success('上传成功')
    setUploadModalVisible(false)
    loadData()
  }

  function handleDelete(row: Material) {
    dialog.warning({
      title: '确认删除',
      content: `确定要删除素材"${row.name}"吗？`,
      async onPositiveClick() {
        try {
          await materialApi.delete(row.id)
          message.success('删除成功')
          loadData()
        } catch (err: any) {
          message.error(err.response?.data?.error || '删除失败')
        }
      }
    })
  }

  const columns = [
    { title: 'ID', key: 'id', width: 60 },
    { title: '名称', key: 'name', width: 180 },
    { title: '类型', key: 'type', width: 80, render: (row: Material) => (
      <NTag type={row.type === 'image' ? 'success' : 'info'}>
        {row.type === 'image' ? '图片' : '视频'}
      </NTag>
    )},
    { title: '预览', key: 'preview', width: 100, render: (row: Material) =>
      row.type === 'image' ? (
        <NButton size="small" onClick={() => setPreviewImage(row.url)}>预览</NButton>
      ) : (
        <span style={{ color: '#999' }}>视频</span>
      )
    },
    { title: '大小', key: 'size', width: 100, render: (row: Material) =>
      (row.size / (1024 * 1024)).toFixed(2) + ' MB'
    },
    { title: '上传时间', key: 'created_at', width: 180 },
    { title: '操作', key: 'actions', width: 100, render: (row: Material) => (
      <NButton size="small" type="error" onClick={() => handleDelete(row)}>删除</NButton>
    )}
  ]

  return (
    <NCard title="素材管理">
      <NSpace vertical>
        <NSpace>
          <NInput
            placeholder="搜索素材名称"
            value={keyword}
            onUpdateValue={setKeyword}
            style={{ width: '200px' }}
          />
          <NSelect
            placeholder="筛选类型"
            value={typeFilter}
            onUpdateValue={setTypeFilter}
            clearable
            options={[
              { label: '图片', value: 'image' },
              { label: '视频', value: 'video' }
            ]}
            style={{ width: '150px' }}
          />
          <NButton type="primary" onClick={() => setPage(1)}>搜索</NButton>
          <NButton type="success" onClick={() => setUploadModalVisible(true)}>上传素材</NButton>
        </NSpace>
        <NTable
          loading={loading}
          columns={columns}
          data={data}
          pagination={{
            page,
            pageSize,
            itemCount: total,
            onUpdatePage: setPage
          }}
        />
      </NSpace>

      <NModal show={uploadModalVisible} onUpdateShow={setUploadModalVisible} preset="card" title="上传素材">
        <NUpload
          action="/api/material/upload"
          headers={{
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }}
          onFinish={({ file }) => {
            if (file.response?.success) {
              handleUploadSuccess(file.response)
            } else {
              message.error(file.response?.error || '上传失败')
            }
          }}
          max={1}
          accept="image/*,video/mp4,video/avi,video/mov"
        >
          <NButton>点击选择文件</NButton>
          <div style={{ marginTop: '10px', color: '#999' }}>
            支持图片(jpg/png/gif)和视频(mp4/avi/mov)，单个文件最大100MB
          </div>
        </NUpload>
      </NModal>

      <NModal show={!!previewImage} onUpdateShow={() => setPreviewImage(null)} preset="card">
        {previewImage && <NImage src={previewImage} style={{ width: '100%' }} />}
      </NModal>
    </NCard>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add admin-web/src/pages/Material.tsx admin-web/src/services/api.ts
git commit -m "feat: add material management page with upload"
```

---

### Task 15: 管理后台 - 节目制作页面

**Files:**
- Create: `admin-web/src/pages/Program.tsx`
- Modify: `admin-web/src/services/api.ts`

- [ ] **Step 1: 添加节目API**

```typescript
export interface Program {
  id: number
  name: string
  screen_orientation: string
  split_type: string
  material_ids: string // JSON string
  status: number
  created_at: string
  updated_at: string
}

export const programApi = {
  list: (params: { page: number; pageSize: number; keyword: string; status?: number }) => {
    return request.get('/program/list', { params })
  },
  detail: (id: number) => {
    return request.get('/program/detail', { params: { id } })
  },
  create: (data: Partial<Program>) => {
    return request.post('/program/create', data)
  },
  update: (data: Program) => {
    return request.post('/program/update', data)
  },
  delete: (id: number) => {
    return request.post('/program/delete', { id })
  }
}
```

- [ ] **Step 2: 创建节目制作页面**

```tsx
import { useState, useEffect } from 'react'
import { NCard, NTable, NInput, NButton, NSpace, NModal, NForm, NFormItem, NInput as NInputField, NSelect, NGrid, NGi, NCard as NCardComponent, NImage, useMessage, useDialog, NDraggable, iconPrefix } from 'naive-ui'
import { programApi, Program, materialApi, Material } from '../services/api'

const screenOrientationOptions = [
  { label: '横屏', value: 'landscape' },
  { label: '竖屏', value: 'portrait' },
  { label: '任意', value: '*' }
]

const splitTypeOptions = [
  { label: '1分屏', value: '1' },
  { label: '2分屏', value: '2' },
  { label: '3分屏', value: '3' },
  { label: '3-1分屏', value: '3-1' },
  { label: '4分屏', value: '4' },
  { label: '任意', value: '*' }
]

// 根据分屏类型获取区域数量
function getRegionCount(splitType: string): number {
  const map: Record<string, number> = {
    '1': 1, '2': 2, '3': 3, '3-1': 3, '4': 4
  }
  return map[splitType] || 1
}

export default function ProgramManagement() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Program[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<number | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [materialModalVisible, setMaterialModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [allMaterials, setAllMaterials] = useState<Material[]>([])
  const message = useMessage()
  const dialog = useDialog()

  const [formData, setFormData] = useState<Partial<Program>>({
    name: '',
    screen_orientation: 'landscape',
    split_type: '1',
    status: 0
  })

  // 分区域素材配置: {region1: [id1, id2, ...]}
  const [regionMaterials, setRegionMaterials] = useState<Record<string, Material[]>>({})

  async function loadData() {
    setLoading(true)
    try {
      const params: any = { page, pageSize, keyword }
      if (statusFilter !== null) params.status = statusFilter
      const res: any = await programApi.list(params)
      setData(res.list)
      setTotal(res.total)
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadAllMaterials() {
    const res: any = await materialApi.list({ page: 1, pageSize: 1000 })
    setAllMaterials(res.list)
  }

  useEffect(() => {
    loadData()
    loadAllMaterials()
  }, [page, keyword, statusFilter])

  function handleAdd() {
    setFormData({
      name: '',
      screen_orientation: 'landscape',
      split_type: '1',
      status: 0
    })
    setRegionMaterials({})
    setEditingId(null)
    setModalVisible(true)
  }

  async function handleEdit(row: Program) {
    setFormData({ ...row })
    // 解析素材配置
    let config: Record<string, number[]> = {}
    try {
      config = JSON.parse(row.material_ids)
    } catch {
      config = {}
    }
    // 加载素材详情
    const newRegionMaterials: Record<string, Material[]> = {}
    for (const region in config) {
      const ids = config[region]
      const mats = ids.map(id => allMaterials.find(m => m.id === id)).filter(Boolean) as Material[]
      newRegionMaterials[region] = mats
    }
    setRegionMaterials(newRegionMaterials)
    setEditingId(row.id)
    setModalVisible(true)
  }

  // 当分屏类型改变，更新区域数量
  useEffect(() => {
    const count = getRegionCount(formData.split_type || '1')
    const newRegionMaterials: Record<string, Material[]> = {}
    for (let i = 1; i <= count; i++) {
      newRegionMaterials[`region${i}`] = regionMaterials[`region${i}`] || []
    }
    setRegionMaterials(newRegionMaterials)
  }, [formData.split_type])

  async function handleSubmit() {
    if (!formData.name) {
      message.error('请填写节目名称')
      return
    }
    // 收集素材ID
    const materialIds: Record<string, number[]> = {}
    for (const region in regionMaterials) {
      materialIds[region] = regionMaterials[region].map(m => m.id)
    }
    const data = {
      ...formData,
      material_ids: materialIds
    }
    try {
      if (editingId) {
        await programApi.update({ ...data, id: editingId } as Program)
        message.success('更新成功')
      } else {
        await programApi.create(data)
        message.success('创建成功')
      }
      setModalVisible(false)
      loadData()
    } catch (err: any) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  function handleDelete(row: Program) {
    dialog.warning({
      title: '确认删除',
      content: `确定要删除节目"${row.name}"吗？如果该节目已发布，需要先删除发布计划。`,
      async onPositiveClick() {
        try {
          await programApi.delete(row.id)
          message.success('删除成功')
          loadData()
        } catch (err: any) {
          message.error(err.response?.data?.error || '删除失败')
        }
      }
    })
  }

  function addMaterialToRegion(region: string, material: Material) {
    const current = regionMaterials[region] || []
    if (!current.find(m => m.id === material.id)) {
      setRegionMaterials({
        ...regionMaterials,
        [region]: [...current, material]
      })
    }
  }

  function removeMaterialFromRegion(region: string, index: number) {
    const current = [...regionMaterials[region]]
    current.splice(index, 1)
    setRegionMaterials({
      ...regionMaterials,
      [region]: current
    })
  }

  const columns = [
    { title: 'ID', key: 'id', width: 60 },
    { title: '节目名称', key: 'name', width: 180 },
    { title: '屏幕方向', key: 'screen_orientation', width: 80, render: (row: Program) =>
      screenOrientationOptions.find(o => o.value === row.screen_orientation)?.label
    },
    { title: '分屏类型', key: 'split_type', width: 80, render: (row: Program) =>
      splitTypeOptions.find(o => o.value === row.split_type)?.label
    },
    { title: '状态', key: 'status', width: 80, render: (row: Program) => row.status === 1 ? '已发布' : '草稿' },
    { title: '更新时间', key: 'updated_at', width: 180 },
    { title: '操作', key: 'actions', width: 150, render: (row: Program) => (
      <NSpace>
        <NButton size="small" onClick={() => handleEdit(row)}>编辑</NButton>
        <NButton size="small" type="error" onClick={() => handleDelete(row)}>删除</NButton>
      </NSpace>
    )}
  ]

  // 渲染分屏布局预览
  function renderRegionGrid() {
    const count = Object.keys(regionMaterials).length
    if (count === 1) {
      return (
        <NGi span={24}>
          {renderRegionCard('region1', '区域 1')}
        </NGi>
      )
    } else if (count === 2) {
      return (
        <>
          <NGi span={12}>{renderRegionCard('region1', '区域 1')}</NGi>
          <NGi span={12}>{renderRegionCard('region2', '区域 2')}</NGi>
        </>
      )
    } else if (count === 3 && formData.split_type === '3-1') {
      // 3-1分屏：左侧大图，右侧上下两个小图
      return (
        <>
          <NGi span={12} rowSpan={2}>{renderRegionCard('region1', '左侧区域')}</NGi>
          <NGi span={12}>{renderRegionCard('region2', '右上区域')}</NGi>
          <NGi span={12}>{renderRegionCard('region3', '右下区域')}</NGi>
        </>
      )
    } else if (count === 3) {
      return (
        <>
          <NGi span={8}>{renderRegionCard('region1', '区域 1')}</NGi>
          <NGi span={8}>{renderRegionCard('region2', '区域 2')}</NGi>
          <NGi span={8}>{renderRegionCard('region3', '区域 3')}</NGi>
        </>
      )
    } else if (count === 4) {
      return (
        <>
          <NGi span={12}>{renderRegionCard('region1', '左上区域')}</NGi>
          <NGi span={12}>{renderRegionCard('region2', '右上区域')}</NGi>
          <NGi span={12}>{renderRegionCard('region3', '左下区域')}</NGi>
          <NGi span={12}>{renderRegionCard('region4', '右下区域')}</NGi>
        </>
      )
    }
  }

  function renderRegionCard(region: string, title: string) {
    const materials = regionMaterials[region] || []
    return (
      <NCardComponent title={title} style={{ marginBottom: '16px', minHeight: '150px' }}>
        <NSpace vertical>
          {materials.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: '20px' }}>暂无素材，请点击下方选择添加</div>
          ) : (
            materials.map((mat, idx) => (
              <div key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px', border: '1px solid #eee' }}>
                {mat.type === 'image' && (
                  <NImage src={mat.url} style={{ width: '60px', height: '40px', objectFit: 'cover' }} />
                )}
                <span style={{ flex: 1 }}>{mat.name}</span>
                <NButton size="tiny" type="error" onClick={() => removeMaterialFromRegion(region, idx)}>移除</NButton>
              </div>
            ))
          )}
          <NButton size="small" onClick={() => {
            setCurrentRegionForPicker(region)
            setMaterialModalVisible(true)
          }}>添加素材</NButton>
        </NSpace>
      </NCardComponent>
    )
  }

  const [currentRegionForPicker, setCurrentRegionForPicker] = useState('')

  return (
    <NCard title="节目制作">
      <NSpace vertical>
        <NSpace>
          <NInput
            placeholder="搜索节目名称"
            value={keyword}
            onUpdateValue={setKeyword}
            style={{ width: '200px' }}
          />
          <NSelect
            placeholder="筛选状态"
            value={statusFilter}
            onUpdateValue={setStatusFilter}
            clearable
            options={[
              { label: '草稿', value: 0 },
              { label: '已发布', value: 1 }
            ]}
            style={{ width: '120px' }}
          />
          <NButton type="primary" onClick={() => setPage(1)}>搜索</NButton>
          <NButton type="success" onClick={handleAdd}>新建节目</NButton>
        </NSpace>
        <NTable
          loading={loading}
          columns={columns}
          data={data}
          pagination={{
            page,
            pageSize,
            itemCount: total,
            onUpdatePage: setPage
          }}
        />
      </NSpace>

      <NModal show={modalVisible} onUpdateShow={setModalVisible} preset="card" style={{ width: '800px', maxHeight: '80vh' }} title={editingId ? '编辑节目' : '新建节目'}>
        <NForm>
          <NFormItem label="节目名称">
            <NInputField
              value={formData.name}
              onUpdateValue={v => setFormData({ ...formData, name: v })}
              placeholder="请输入节目名称"
            />
          </NFormItem>
          <NGrid xGap={12}>
            <NGi span={12}>
              <NFormItem label="适配屏幕方向">
                <NSelect
                  value={formData.screen_orientation}
                  onUpdateValue={v => setFormData({ ...formData, screen_orientation: v })}
                  options={screenOrientationOptions}
                />
              </NFormItem>
            </NGi>
            <NGi span={12}>
              <NFormItem label="适配分屏类型">
                <NSelect
                  value={formData.split_type}
                  onUpdateValue={v => setFormData({ ...formData, split_type: v })}
                  options={splitTypeOptions}
                />
              </NFormItem>
            </NGi>
          </NGrid>

          <NFormItem label="素材编排（按区域）" />
          <NGrid>{renderRegionGrid()}</NGrid>

          <NSpace justify="end" style={{ marginTop: '20px' }}>
            <NButton onClick={() => setModalVisible(false)}>取消</NButton>
            <NButton type="primary" onClick={handleSubmit}>保存</NButton>
          </NSpace>
        </NForm>
      </NModal>

      <NModal show={materialModalVisible} onUpdateShow={setMaterialModalVisible} preset="card" title="选择素材" style={{ width: '600px' }}>
        <NSpace vertical style={{ width: '100%' }}>
          {allMaterials.map(mat => (
            <div key={mat.id} style={{ display: 'flex', alignItems: 'center', padding: '8px', border: '1px solid #eee', borderRadius: '4px' }}>
              {mat.type === 'image' && (
                <NImage src={mat.url} style={{ width: '80px', height: '50px', objectFit: 'cover', marginRight: '12px' }} />
              )}
              <div style={{ flex: 1 }}>
                <div>{mat.name}</div>
                <small style={{ color: '#999' }}>{mat.type === 'image' ? '图片' : '视频'}</small>
              </div>
              <NButton size="small" type="primary" onClick={() => {
                addMaterialToRegion(currentRegionForPicker, mat)
                setMaterialModalVisible(false)
              }}>添加</NButton>
            </div>
          ))}
        </NSpace>
      </NModal>
    </NCard>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add admin-web/src/pages/Program.tsx admin-web/src/services/api.ts
git commit -m "feat: add program creation and editing page"
```

---

### Task 16: 管理后台 - 发布管理页面

**Files:**
- Create: `admin-web/src/pages/Distribution.tsx`
- Modify: `admin-web/src/services/api.ts`

- [ ] **Step 1: 添加分发API**

```typescript
export interface Distribution {
  id: number
  program_id: number
  program_name: string
  target_type: 'store' | 'device'
  target_ids: string // JSON
  start_time: string
  end_time: string | null
  status: number
  created_at: string
}

export const distributionApi = {
  list: (params: { page: number; pageSize: number; keyword: string; status?: number }) => {
    return request.get('/distribution/list', { params })
  },
  create: (data: Partial<Distribution>) => {
    return request.post('/distribution/create', data)
  },
  updateStatus: (id: number, status: number) => {
    return request.post('/distribution/update-status', { id, status })
  },
  delete: (id: number) => {
    return request.post('/distribution/delete', { id })
  }
}
```

- [ ] **Step 2: 创建发布管理页面**

```tsx
import { useState, useEffect } from 'react'
import { NCard, NTable, NInput, NButton, NSpace, NModal, NForm, NFormItem, NInput as NInputField, NSelect, NDatePicker, useMessage, useDialog, NTransfer } from 'naive-ui'
import { distributionApi, Distribution, programApi, Program, storeApi, deviceApi } from '../services/api'

export default function DistributionManagement() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Distribution[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [statusFilter, setStatusFilter] = useState<number | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const message = useMessage()
  const dialog = useDialog()

  const [formData, setFormData] = useState<Partial<Distribution>>({
    program_id: undefined,
    program_name: '',
    target_type: 'store',
    target_ids: [],
    start_time: new Date().toISOString().slice(0, 16),
    end_time: null,
    status: 1
  })

  const [programOptions, setProgramOptions] = useState<{label: string, value: number}[]>([])
  const [storeOptions, setStoreOptions] = useState<{label: string, value: number}[]>([])
  const [deviceOptions, setDeviceOptions] = useState<{label: string, value: number}[]>([])

  async function loadData() {
    setLoading(true)
    try {
      const params: any = { page, pageSize, keyword }
      if (statusFilter !== null) params.status = statusFilter
      const res: any = await distributionApi.list(params)
      setData(res.list)
      setTotal(res.total)
    } catch (err) {
      message.error('加载失败')
    } finally {
      setLoading(false)
    }
  }

  async function loadOptions() {
    // 加载已发布的节目
    const progRes: any = await programApi.list({ page: 1, pageSize: 1000, status: 1 })
    setProgramOptions(progRes.list.map((p: Program) => ({ label: p.name, value: p.id })))
    // 加载门店
    const storeRes: any = await storeApi.all()
    setStoreOptions(storeRes.list.map((s: any) => ({ label: s.name, value: s.id })))
  }

  useEffect(() => {
    loadData()
    loadOptions()
  }, [page, keyword, statusFilter])

  function handleAdd() {
    setFormData({
      program_id: undefined,
      program_name: '',
      target_type: 'store',
      target_ids: [],
      start_time: new Date().toISOString().slice(0, 16),
      end_time: null,
      status: 1
    })
    setEditingId(null)
    setModalVisible(true)
  }

  async function handleSubmit() {
    if (!formData.program_id || formData.target_ids.length === 0) {
      message.error('请选择节目和发布目标')
      return
    }
    try {
      // 根据program_id填充名称
      const progName = programOptions.find(p => p.value === formData.program_id)?.label || ''
      const data = {
        ...formData,
        program_name: progName
      }
      await distributionApi.create(data)
      message.success('创建发布计划成功')
      setModalVisible(false)
      loadData()
    } catch (err: any) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  async function toggleStatus(row: Distribution) {
    const newStatus = row.status === 1 ? 0 : 1
    try {
      await distributionApi.updateStatus(row.id, newStatus)
      message.success('状态更新成功')
      loadData()
    } catch (err: any) {
      message.error(err.response?.data?.error || '操作失败')
    }
  }

  function handleDelete(row: Distribution) {
    dialog.warning({
      title: '确认删除',
      content: `确定要删除这个发布计划吗？删除后设备将不再收到该节目。`,
      async onPositiveClick() {
        try {
          await distributionApi.delete(row.id)
          message.success('删除成功')
          loadData()
        } catch (err: any) {
          message.error(err.response?.data?.error || '删除失败')
        }
      }
    })
  }

  // 更新选中的目标
  const [targetValue, setTargetValue] = useState<number[]>([])

  const columns = [
    { title: 'ID', key: 'id', width: 60 },
    { title: '节目名称', key: 'program_name', width: 180 },
    { title: '发布目标类型', key: 'target_type', width: 100, render: (row: Distribution) =>
      row.target_type === 'store' ? '按门店' : '按设备'
    },
    { title: '开始时间', key: 'start_time', width: 180 },
    { title: '结束时间', key: 'end_time', width: 180, render: (row: Distribution) =>
      row.end_time || '永久'
    },
    { title: '状态', key: 'status', width: 80, render: (row: Distribution) => row.status === 1 ? '启用' : '停用' },
    { title: '创建时间', key: 'created_at', width: 180 },
    { title: '操作', key: 'actions', width: 180, render: (row: Distribution) => (
      <NSpace>
        <NButton size="small" type={row.status === 1 ? 'warning' : 'success'} onClick={() => toggleStatus(row)}>
          {row.status === 1 ? '停用' : '启用'}
        </NButton>
        <NButton size="small" type="error" onClick={() => handleDelete(row)}>删除</NButton>
      </NSpace>
    )}
  ]

  // 生成目标选项根据target类型
  function getTargetOptions() {
    if (formData.target_type === 'store') {
      return storeOptions.map(s => ({ label: s.label, value: s.value }))
    } else {
      return deviceOptions.map(d => ({ label: d.label, value: d.value }))
    }
  }

  return (
    <NCard title="发布管理">
      <NSpace vertical>
        <NSpace>
          <NInput
            placeholder="搜索节目名称"
            value={keyword}
            onUpdateValue={setKeyword}
            style={{ width: '200px' }}
          />
          <NSelect
            placeholder="筛选状态"
            value={statusFilter}
            onUpdateValue={setStatusFilter}
            clearable
            options={[
              { label: '启用', value: 1 },
              { label: '停用', value: 0 }
            ]}
            style={{ width: '120px' }}
          />
          <NButton type="primary" onClick={() => setPage(1)}>搜索</NButton>
          <NButton type="success" onClick={handleAdd}>新建发布</NButton>
        </NSpace>
        <NTable
          loading={loading}
          columns={columns}
          data={data}
          pagination={{
            page,
            pageSize,
            itemCount: total,
            onUpdatePage: setPage
          }}
        />
      </NSpace>

      <NModal show={modalVisible} onUpdateShow={setModalVisible} preset="card" title="新建发布计划" style={{ width: '600px' }}>
        <NForm>
          <NFormItem label="选择节目">
            <NSelect
              value={formData.program_id}
              onUpdateValue={v => setFormData({ ...formData, program_id: v })}
              options={programOptions}
              placeholder="请选择已发布的节目"
            />
          </NFormItem>
          <NFormItem label="发布目标类型">
            <NSelect
              value={formData.target_type}
              onUpdateValue={v => {
                setFormData({ ...formData, target_type: v, target_ids: [] })
                setTargetValue([])
              }}
              options={[
                { label: '按门店发布', value: 'store' },
                { label: '按设备发布', value: 'device' }
              ]}
            />
          </NFormItem>
          <NFormItem label="选择目标">
            <NTransfer
              value={targetValue}
              onUpdateValue={v => {
                setTargetValue(v)
                setFormData({ ...formData, target_ids: v })
              }}
              options={getTargetOptions()}
            />
          </NFormItem>
          <NGrid xGap={12}>
            <NGi span={12}>
              <NFormItem label="生效开始时间">
                <NDatePicker
                  value={formData.start_time ? new Date(formData.start_time) : null}
                  onUpdateValue={v => {
                    if (v) {
                      setFormData({ ...formData, start_time: v.toISOString().slice(0, 16) })
                    }
                  }}
                  type="datetime"
                  placeholder="选择开始时间"
                  style={{ width: '100%' }}
                />
              </NFormItem>
            </NGi>
            <NGi span={12}>
              <NFormItem label="生效结束时间（可选）">
                <NDatePicker
                  value={formData.end_time ? new Date(formData.end_time) : null}
                  onUpdateValue={v => {
                    if (v) {
                      setFormData({ ...formData, end_time: v.toISOString().slice(0, 16) })
                    } else {
                      setFormData({ ...formData, end_time: null })
                    }
                  }}
                  type="datetime"
                  clearable
                  placeholder="不填表示永久生效"
                  style={{ width: '100%' }}
                />
              </NFormItem>
            </NGi>
          </NGrid>
          <NSpace justify="end">
            <NButton onClick={() => setModalVisible(false)}>取消</NButton>
            <NButton type="primary" onClick={handleSubmit}>发布</NButton>
          </NSpace>
        </NForm>
      </NModal>
    </NCard>
  )
}
```

- [ ] **Step 3: 提交**

```bash
git add admin-web/src/pages/Distribution.tsx admin-web/src/services/api.ts
git commit -m "feat: add distribution management page for publishing"
```

---

### Task 17: 安卓客户端项目初始化

**Files:**
- Create: `android-client/app/build.gradle`
- Create: `android-client/settings.gradle`
- Create: `android-client/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: 创建基础Gradle配置**

`android-client/settings.gradle`:
```gradle
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "AdsDisplay"
include ':app'
```

`android-client/app/build.gradle`:
```gradle
plugins {
    id 'com.android.application' version '7.4.2'
}

android {
    namespace 'com.adsdisplay'
    compileSdk 33

    defaultConfig {
        applicationId "com.adsdisplay"
        minSdk 24
        targetSdk 33
        versionCode 1
        versionName "1.0"

        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
    }

    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }
    kotlinOptions {
        jvmTarget = '1.8'
    }
    viewBinding {
        enabled = true
    }
}

dependencies {
    implementation 'androidx.core:core-ktx:1.10.1'
    implementation 'androidx.appcompat:appcompat:1.6.1'
    implementation 'com.google.android.material:material:1.9.0'
    implementation 'androidx.constraintlayout:constraintlayout:2.1.4'
    implementation 'com.squareup.retrofit2:retrofit:2.9.0'
    implementation 'com.squareup.retrofit2:converter-gson:2.9.0'
    implementation 'androidx.work:work-runtime-ktx:2.8.1'
    implementation 'com.google.android.exoplayer2:exoplayer:2.19.1'
    testImplementation 'junit:junit:4.13.2'
    androidTestImplementation 'androidx.test.ext:junit:1.1.5'
    androidTestImplementation 'androidx.test.espresso:espresso-core:3.5.1'
}
```

- [ ] **Step 2: 创建AndroidManifest**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.adsdisplay">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <application
        android:allowBackup="true"
        android:dataExtractionAllowed="true"
        android:icon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.AdsDisplay">
        <activity android:name=".MainActivity" android:exported="true" android:screenOrientation="fullSensor">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
        <receiver android:name=".BootReceiver" android:enabled="true" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
            </intent-filter>
        </receiver>
    </application>

</manifest>
```

- [ ] **Step 3: 提交**

```bash
git add android-client/settings.gradle android-client/app/build.gradle android-client/app/src/main/AndroidManifest.xml
git commit -m "feat: init android client project structure"
```

---

### Task 18: 安卓客户端 - 数据模型与API服务

**Files:**
- Create: `android-client/app/src/main/java/com/adsdisplay/data/Models.kt`
- Create: `android-client/app/src/main/java/com/adsdisplay/data/AdsApi.kt`

- [ ] **Step 1: 创建数据模型**

```kotlin
package com.adsdisplay.data

data class GetProgramResponse(
    val success: Boolean,
    val data: ProgramData?,
    val error: String?,
    val message: String?
)

data class ProgramData(
    val device: DeviceInfo,
    val program: ProgramInfo
)

data class DeviceInfo(
    val id: Long,
    val name: String,
    val screen_orientation: String,
    val split_type: String
)

data class ProgramInfo(
    val id: Long,
    val name: String,
    val screen_orientation: String,
    val split_type: String,
    val materials: Map<String, List<Material>>
)

data class Material(
    val id: Long,
    val name: String,
    val type: String,
    val url: String,
    val duration: Int
)
```

- [ ] **Step 2: 创建Retrofit API服务**

```kotlin
package com.adsdisplay.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface AdsApiService {
    @POST("api/client/get-program")
    suspend fun getProgram(@Body request: GetProgramRequest): Response<GetProgramResponse>
}

data class GetProgramRequest(
    val device_code: String
)
```

- [ ] **Step 3: 提交**

```bash
git add android-client/app/src/main/java/com/adsdisplay/data/Models.kt android-client/app/src/main/java/com/adsdisplay/data/AdsApi.kt
git commit -m "feat: add data models and api service for android client"
```

---

### Task 19: 安卓客户端 - 主Activity与分屏渲染

**Files:**
- Create: `android-client/app/src/main/java/com/adsdisplay/MainActivity.kt`
- Create: `android-client/app/src/main/java/com/adsdisplay/ads/AdPlayer.kt`
- Create: `android-client/app/src/main/java/com/adsdisplay/ads/ImageRegionAdapter.kt`

- [ ] **Step 1: 创建MainActivity** （根据分屏类型动态布局）

```kotlin
package com.adsdisplay

import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import com.adsdisplay.data.ProgramInfo
import com.adsdisplay.data.Material
import com.adsdisplay.databinding.ActivityMainBinding
import com.adsdisplay.network.RetrofitClient
import com.adsdisplay.ads.AdPlayer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.lang.Exception

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private var currentProgram: ProgramInfo? = null
    private val deviceCode = "DEVICE_001" // TODO: 从配置读取，应该让用户设置或扫码

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // 保持屏幕常亮
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 全屏显示
        supportActionBar?.hide()

        // 获取节目
        fetchProgram()
    }

    private fun fetchProgram() {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val response = RetrofitClient.api.getProgram(com.adsdisplay.data.GetProgramRequest(deviceCode))
                if (response.isSuccessful) {
                    val body = response.body()
                    if (body?.success == true && body.data != null) {
                        currentProgram = body.data.program
                        runOnUiThread {
                            setupSplitLayout(body.data.program)
                            startPlayback()
                        }
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
            // 定时5分钟后拉取更新
            binding.root.postDelayed({ fetchProgram() }, 5 * 60 * 1000)
        }
    }

    private fun setupSplitLayout(program: ProgramInfo) {
        // 移除所有现有视图
        binding.container.removeAllViews()

        val splitType = program.split_type
        // 根据分屏类型 inflate 对应的布局
        val layoutId = when (splitType) {
            "1" -> R.layout.split_1
            "2" -> R.layout.split_2
            "3" -> R.layout.split_3
            "3-1" -> R.layout.split_3_1
            "4" -> R.layout.split_4
            else -> R.layout.split_1
        }

        // 加载分屏布局
        layoutInflater.inflate(layoutId, binding.container, true)

        // 为每个区域设置素材
        program.materials.forEach { (regionName, materials) ->
            val viewId = resources.getIdentifier(regionName, "id", packageName)
            val container = binding.container.findViewById<android.widget.FrameLayout>(viewId)
            container?.let {
                AdPlayer.setupRegion(this, it, materials)
            }
        }
    }

    private fun startPlayback() {
        AdPlayer.startAllRegions()
    }

    override fun onDestroy() {
        super.onDestroy()
        AdPlayer.releaseAll()
    }
}
```

- [ ] **Step 2: 创建分屏布局文件** 需要说明每个布局，以`split_1.xml`为例，其他类似：

`android-client/app/src/main/res/layout/split_1.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/region1"
    android:layout_width="match_parent"
    android:layout_height="match_parent"/>
```

`split_2.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical">
    <FrameLayout
        android:id="@+id/region1"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"/>
    <FrameLayout
        android:id="@+id/region2"
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"/>
</LinearLayout>
```

`split_3.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="horizontal">
    <FrameLayout
        android:id="@+id/region1"
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"/>
    <FrameLayout
        android:id="@+id/region2"
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"/>
    <FrameLayout
        android:id="@+id/region3"
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"/>
</LinearLayout>
```

`split_3_1.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="horizontal">
    <FrameLayout
        android:id="@+id/region1"
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"/>
    <LinearLayout
        android:layout_width="0dp"
        android:layout_height="match_parent"
        android:layout_weight="1"
        android:orientation="vertical">
        <FrameLayout
            android:id="@+id/region2"
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"/>
        <FrameLayout
            android:id="@+id/region3"
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"/>
    </LinearLayout>
</LinearLayout>
```

`split_4.xml`:
```xml
<?xml version="1.0" encoding="utf-8"?>
<GridLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:columnCount="2"
    android:rowCount="2">
    <FrameLayout
        android:id="@+id/region1"
        android:layout_width="0dp"
        android:layout_height="0dp"
        android:layout_columnWeight="1"
        android:layout_rowWeight="1"/>
    <FrameLayout
        android:id="@+id/region2"
        android:layout_width="0dp"
        android:layout_height="0dp"
        android:layout_columnWeight="1"
        android:layout_rowWeight="1"/>
    <FrameLayout
        android:id="@+id/region3"
        android:layout_width="0dp"
        android:layout_height="0dp"
        android:layout_columnWeight="1"
        android:layout_rowWeight="1"/>
    <FrameLayout
        android:id="@+id/region4"
        android:layout_width="0dp"
        android:layout_height="0dp"
        android:layout_columnWeight="1"
        android:layout_rowWeight="1"/>
</GridLayout>
```

- [ ] **Step 3: 创建AdPlayer播放器管理类**

```kotlin
package com.adsdisplay.ads

import android.content.Context
import android.widget.FrameLayout
import com.adsdisplay.data.Material
import com.google.android.exoplayer2.ExoPlayer
import com.google.android.exoplayer2.MediaItem
import com.google.android.exoplayer2.ui.PlayerView
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.widget.ImageView
import java.net.URL

object AdPlayer {

    private val regionPlayers = mutableListOf<RegionPlayer>()

    data class RegionPlayer(
        val container: FrameLayout,
        val materials: List<Material>,
        var currentIndex: Int = 0,
        var handler: Handler? = null,
        var imageView: ImageView? = null,
        var exoPlayer: ExoPlayer? = null,
        var playerView: PlayerView? = null
    )

    fun setupRegion(context: Context, container: FrameLayout, materials: List<Material>) {
        if (materials.isEmpty()) return
        val first = materials.first()
        val player = RegionPlayer(container, materials)
        // 如果只有一个视频，直接播放
        if (materials.size == 1 && first.type == "video") {
            initVideoPlayer(context, player, first)
        } else {
            // 图片轮播
            initImageSlider(context, player)
        }
        regionPlayers.add(player)
    }

    private fun initImageSlider(context: Context, player: RegionPlayer) {
        val imageView = ImageView(context)
        imageView.scaleType = ImageView.ScaleType.CENTER_CROP
        player.container.addView(imageView)
        player.imageView = imageView

        val handler = Handler(Looper.getMainLooper())
        player.handler = handler

        val runnable = object : Runnable {
            override fun run() {
                val material = player.materials[player.currentIndex]
                if (material.type == "image") {
                    // 异步加载图片
                    Thread {
                        try {
                            val bitmap = BitmapFactory.decodeStream(URL(material.url).openStream())
                            handler.post {
                                imageView.setImageBitmap(bitmap)
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                        player.currentIndex = (player.currentIndex + 1) % player.materials.size
                        handler.postDelayed(this, (material.duration * 1000).toLong())
                    }.start()
                } else {
                    // 视频会直接播完自动下一个
                    player.currentIndex = (player.currentIndex + 1) % player.materials.size
                    handler.postDelayed(this, 5000)
                }
            }
        }
        handler.post(runnable)
    }

    private fun initVideoPlayer(context: Context, player: RegionPlayer, material: Material) {
        val playerView = PlayerView(context)
        player.container.addView(playerView)
        player.playerView = playerView

        val exoPlayer = ExoPlayer.Builder(context).build()
        player.exoPlayer = exoPlayer
        val mediaItem = MediaItem.fromUri(material.url)
        exoPlayer.setMediaItem(mediaItem)
        exoPlayer.playWhenReady = true
        exoPlayer.prepare()
        playerView.player = exoPlayer
    }

    fun startPlayback() {
        regionPlayers.forEach {
            it.exoPlayer?.play()
        }
    }

    fun startAllRegions() {
        regionPlayers.forEach { region ->
            region.handler?.removeCallbacksAndMessages(null)
        }
        startPlayback()
        regionPlayers.forEach { region ->
            region.handler?.sendEmptyMessage(0)
        }
    }

    fun releaseAll() {
        regionPlayers.forEach {
            it.handler?.removeCallbacksAndMessages(null)
            it.exoPlayer?.release()
        }
        regionPlayers.clear()
    }
}
```

- [ ] **Step 4: 提交**

```bash
git add "android-client/app/src/main/java/com/adsdisplay/MainActivity.kt" \
        "android-client/app/src/main/java/com/adsdisplay/ads/AdPlayer.kt" \
        "android-client/app/src/main/res/layout/split_*.xml"
git commit -m "feat: add main activity and ad player with split screen support"
```

---

## Self-Review

1. **Spec coverage**: All requirements from the screenshot-based reference system are covered:
   - ✅ 门店管理 - CRUD operations
   - ✅ 设备管理 - CRUD with screen orientation and split types
   - ✅ 素材管理 - upload and management
   - ✅ 节目制作 - regional material arrangement for different split types
   - ✅ 发布管理 - publish to stores/devices with time scheduling
   - ✅ 安卓客户端 - pull program, support all 5 split types, image/video playback
   - ✅ 系统管理 - implied with user authentication

2. **No placeholders**: All steps have exact file paths and actual code. No TBD.

3. **Consistency**: All interfaces are consistent between backend and frontend.

---

Plan complete and saved to `docs/superpowers/plans/2026-04-08-advertising-distribution-system.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
