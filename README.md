<div align="center">

# 💰 Artho AI

### AI-Powered Personal Financial Health & Savings Assistant

**Understand your money. Plan smarter. Reach your goals.**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Artho%20AI-success?style=for-the-badge)](https://arthobachao-ai.onrender.com)
[![GitHub](https://img.shields.io/badge/GitHub-Source%20Code-black?style=for-the-badge&logo=github)](https://github.com/ahanaf-star/artho-ai)

</div>

---

## 🚀 Live Demo

👉 **[Visit Artho AI](https://arthobachao-ai.onrender.com)**

The application is deployed and accessible online.

---

## 📌 About the Project

**Artho AI** is an AI-powered personal financial health and savings assistant designed to help users understand their spending, manage savings goals, monitor cash flow, and make more informed financial decisions.

The application combines financial data analysis with **Google Gemini AI** to provide contextual explanations and personalized financial guidance.

The project is built using synthetic/demo financial data and does not use real user financial information.

---

## ✨ Key Features

- 📊 **Financial Dashboard**
  - Income and expense overview
  - Current savings
  - Financial health indicators

- 💳 **Spending Analysis**
  - Category-wise spending
  - Spending trends
  - Monthly financial insights

- 🎯 **Savings Goals**
  - Create and manage savings goals
  - Track progress
  - Monitor target amounts and deadlines

- 🤖 **AI Financial Coach**
  - Context-aware financial guidance
  - Spending explanations
  - Savings suggestions
  - Personalized financial insights using Gemini AI

- 📈 **Cash Flow Forecast**
  - Income and expense forecasting
  - Future cash-flow visualization

- 🔐 **Authentication**
  - User signup and login
  - Secure password hashing
  - User-specific financial data

- 🌐 **Responsive Web Interface**
  - Modern fintech-style UI
  - Desktop and mobile friendly

- 🌍 **Language Support**
  - English
  - বাংলা

---

## 🧠 AI Integration

Artho AI uses **Google Gemini** as the intelligent financial coaching layer.

The application provides Gemini with relevant financial context such as:

- Income
- Expenses
- Spending categories
- Savings
- Savings goals
- Cash-flow forecast
- Unusual spending patterns

The application's financial calculations remain deterministic, while Gemini is used to interpret the information and provide contextual explanations and guidance.

### Responsible AI

The system is designed as a financial assistance and education tool rather than an autonomous financial decision-maker.

It does not execute financial transactions or make consequential financial decisions on behalf of users.

---

## 🛠️ Tech Stack

### Frontend
- React
- TypeScript
- Vite
- HTML
- CSS

### Backend
- Node.js
- Express.js

### Database
- MongoDB
- MongoDB Atlas
- Mongoose

### AI
- Google Gemini API

### Deployment
- Render
- MongoDB Atlas

### Development Tools
- Visual Studio Code
- Git & GitHub

---

## 🏗️ System Architecture

```text
                ┌──────────────────────┐
                │      User            │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   React Frontend     │
                │  Dashboard / Goals   │
                │ Spending / AI Coach  │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   Express Backend    │
                │   REST API / Auth    │
                └───────┬───────┬──────┘
                        │       │
              ┌─────────┘       └──────────┐
              ▼                            ▼
     ┌─────────────────┐          ┌─────────────────┐
     │ MongoDB Atlas   │          │  Gemini API     │
     │ Users / Data    │          │ AI Coach        │
     └─────────────────┘          └─────────────────┘