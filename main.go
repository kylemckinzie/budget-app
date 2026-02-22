package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/gorilla/mux"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// Structure definitions
type User struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Username  string    `json:"username" gorm:"uniqueIndex"`
	Password  string    `json:"password"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Income struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id" gorm:"index"`
	Amount    float64   `json:"amount"`
	Type      string    `json:"type"` // Monthly or Daily
	Date      time.Time `json:"date"`
	Month     int       `json:"month"`
	Year      int       `json:"year"`
	CreatedAt time.Time `json:"created_at"`
}

type Budget struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `json:"user_id" gorm:"index"`
	BaytulMol   float64   `json:"baytul_mol"`
	OilaUchun   float64   `json:"oila_uchun"`
	TalimUchun  float64   `json:"talim_uchun"`
	BiznesRivoj float64   `json:"biznes_rivoj"`
	Month       int       `json:"month"`
	Year        int       `json:"year"`
	TotalIncome float64   `json:"total_income"`
	TotalSpent  float64   `json:"total_spent"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Expense struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	UserID      uint      `json:"user_id" gorm:"index"`
	Date        time.Time `json:"date"`
	Month       int       `json:"month"`
	Year        int       `json:"year"`
	Category    string    `json:"category"`
	Amount      float64   `json:"amount"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Note struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	UserID    uint      `json:"user_id" gorm:"index"`
	Date      time.Time `json:"date"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

var (
	db *gorm.DB
	mu sync.Mutex
)

type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type IncomeRequest struct {
	Amount float64 `json:"amount"`
	Type   string  `json:"type"`
	UserID uint    `json:"user_id"`
	Month  int     `json:"month"`
	Year   int     `json:"year"`
	Date   string  `json:"date"`
}

type ExpenseRequest struct {
	Category    string  `json:"category"`
	Amount      float64 `json:"amount"`
	Description string  `json:"description"`
	UserID      uint    `json:"user_id"`
	Month       int     `json:"month"`
	Year        int     `json:"year"`
	Date        string  `json:"date"`
}

type NoteRequest struct {
	Content string `json:"content"`
	UserID  uint   `json:"user_id"`
}

// Global variables

func main() {
	// Database initialization
	initDB()
	// Router setup
	r := mux.NewRouter()

	// CORS middleware
	r.Use(corsMiddleware)

	// API routes
	api := r.PathPrefix("/api").Subrouter()

	// Authentication routes
	api.HandleFunc("/register", registerHandler).Methods("POST", "OPTIONS")
	api.HandleFunc("/login", loginHandler).Methods("POST", "OPTIONS")

	// Budget routes
	api.HandleFunc("/budget", getBudgetHandler).Methods("GET", "OPTIONS")
	api.HandleFunc("/income", addIncomeHandler).Methods("POST", "OPTIONS")
	api.HandleFunc("/incomes", getIncomesHandler).Methods("GET", "OPTIONS")
	api.HandleFunc("/expense", addExpenseHandler).Methods("POST", "OPTIONS")
	api.HandleFunc("/expenses", getExpensesHandler).Methods("GET", "OPTIONS")
	api.HandleFunc("/statistics", getStatisticsHandler).Methods("GET", "OPTIONS")

	// Notes routes
	api.HandleFunc("/notes", getNotesHandler).Methods("GET", "OPTIONS")
	api.HandleFunc("/notes", addNoteHandler).Methods("POST", "OPTIONS")
	api.HandleFunc("/notes/{id}", deleteNoteHandler).Methods("DELETE", "OPTIONS")

	// Serve static files
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./static/")))

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("🚀 Server is running on http://localhost:%s\n", port)
	fmt.Printf("📊 Database file: budget_new.db\n")
	log.Fatal(http.ListenAndServe(":"+port, r))
}

// Database initialization
func initDB() {
	var err error

	dsn := os.Getenv("DATABASE_URL")
	if dsn != "" {
		// Fix for Supabase IPv6/IPv4 connection issues on Render
		// Supabase direct connection (5432) is IPv6 only. Port 6543 (Pooler) supports IPv4.
		if strings.Contains(dsn, "supabase.co") && strings.Contains(dsn, ":5432") {
			fmt.Println("🔧 Detected Supabase URL with port 5432. Switching to port 6543 for IPv4 compatibility...")
			dsn = strings.ReplaceAll(dsn, ".supabase.co:5432", ".supabase.co:6543")
		}

		fmt.Println("☁️  Connecting to PostgreSQL...")
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	} else {
		fmt.Println("📂 Connecting to SQLite (Local)...")
		db, err = gorm.Open(sqlite.Open("budget_new.db"), &gorm.Config{})
	}

	if err != nil {
		log.Fatal("❌ Failed to connect to database:", err)
	}

	// Database migratsiya
	err = db.AutoMigrate(&User{}, &Budget{}, &Expense{}, &Note{}, &Income{})
	if err != nil {
		log.Fatal("❌ Failed to migrate database:", err)
	}

	fmt.Println("✅ Database initialized successfully")
	fmt.Println("✅ Tables created: users, budgets, expenses, notes, incomes")

	// Test ma'lumot qo'shish (ixtiyoriy)
	createTestData()
}
func createTestData() {
	// Test user mavjudligini tekshirish
	var userCount int64
	db.Model(&User{}).Count(&userCount)

	if userCount == 0 {
		testUser := User{
			Username: "test",
			Password: "test123",
			Email:    "test@example.com",
		}
		db.Create(&testUser)
		fmt.Println("✅ Test user created: test/test123")
	}
}

// Middleware
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, User-ID")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func getOrCreateBudget(uid uint, m int, y int) Budget {
	var b Budget
	if m == 0 || y == 0 {
		now := time.Now()
		m, y = int(now.Month()), now.Year()
	}
	err := db.Where("user_id = ? AND month = ? AND year = ?", uid, m, y).First(&b).Error
	if err != nil {
		var last Budget
		// Look for the most recent month before this one
		db.Where("user_id = ? AND (year < ? OR (year = ? AND month < ?))", uid, y, y, m).
			Order("year DESC, month DESC").First(&last)

		b = Budget{
			UserID: uid, Month: m, Year: y,
			BaytulMol: last.BaytulMol, OilaUchun: last.OilaUchun,
			TalimUchun: last.TalimUchun, BiznesRivoj: last.BiznesRivoj,
		}
		db.Create(&b)
	}
	return b
}

// Handlers
func registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		return
	}

	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		sendErrorResponse(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Username mavjudligini tekshirish
	var existingUser User
	if err := db.Where("username = ?", user.Username).First(&existingUser).Error; err == nil {
		sendErrorResponse(w, "Username already exists", http.StatusConflict)
		return
	}

	// Yangi user yaratish
	if err := db.Create(&user).Error; err != nil {
		sendErrorResponse(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	// Yangi user uchun budget yaratish
	budget := Budget{
		UserID:      user.ID,
		BaytulMol:   0,
		OilaUchun:   0,
		TalimUchun:  0,
		BiznesRivoj: 0,
		TotalIncome: 0,
		TotalSpent:  0,
	}

	if err := db.Create(&budget).Error; err != nil {
		sendErrorResponse(w, "Failed to create budget", http.StatusInternalServerError)
		return
	}

	sendSuccessResponse(w, "User registered successfully", map[string]interface{}{
		"user_id":  user.ID,
		"username": user.Username,
	})
}
func loginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		return
	}

	var creds struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&creds); err != nil {
		sendErrorResponse(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var user User
	if err := db.Where("username = ? AND password = ?", creds.Username, creds.Password).First(&user).Error; err != nil {
		sendErrorResponse(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	sendSuccessResponse(w, "Login successful", map[string]interface{}{
		"user_id":  user.ID,
		"username": user.Username,
		"token":    fmt.Sprintf("token-%d", user.ID),
	})
}
func getBudgetHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		return
	}

	userID := r.URL.Query().Get("user_id")
	mStr := r.URL.Query().Get("month") // Get month from URL
	yStr := r.URL.Query().Get("year")  // Get year from URL

	if userID == "" {
		sendErrorResponse(w, "User ID required", http.StatusBadRequest)
		return
	}

	uid, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		sendErrorResponse(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// Default to current time
	now := time.Now()
	month := int(now.Month())
	year := now.Year()

	// If the user picked a date in the Frontend, use that instead
	if mStr != "" {
		if val, err := strconv.Atoi(mStr); err == nil && val > 0 {
			month = val
		}
	}
	if yStr != "" {
		if val, err := strconv.Atoi(yStr); err == nil && val > 0 {
			year = val
		}
	}

	// Use our helper to find or create that specific month's record
	budget := getOrCreateBudget(uint(uid), month, year)

	sendSuccessResponse(w, "Budget retrieved", budget)
}
func addIncomeHandler(w http.ResponseWriter, r *http.Request) {
	var req IncomeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendErrorResponse(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var incomeDate time.Time
	if req.Date != "" {
		if parsed, err := time.Parse("2006-01-02", req.Date); err == nil {
			incomeDate = parsed
			req.Month = int(parsed.Month())
			req.Year = parsed.Year()
		}
	}

	if incomeDate.IsZero() {
		incomeDate = time.Now()
		if req.Month == 0 {
			req.Month = int(incomeDate.Month())
		}
		if req.Year == 0 {
			req.Year = incomeDate.Year()
		}
	}

	mu.Lock()
	defer mu.Unlock()

	b := getOrCreateBudget(req.UserID, req.Month, req.Year)

	if err := db.Create(&Income{
		UserID: req.UserID, Amount: req.Amount, Type: req.Type,
		Month: req.Month, Year: req.Year, Date: incomeDate,
	}).Error; err != nil {
		sendErrorResponse(w, "Failed to create income log", http.StatusInternalServerError)
		return
	}

	b.TotalIncome += req.Amount
	b.BaytulMol += req.Amount * 0.1
	b.OilaUchun += req.Amount * 0.3
	b.TalimUchun += req.Amount * 0.2
	b.BiznesRivoj += req.Amount * 0.4
	if err := db.Save(&b).Error; err != nil {
		sendErrorResponse(w, "Failed to update budget", http.StatusInternalServerError)
		return
	}

	sendSuccessResponse(w, "Income log created and budget updated", b)
}
func addExpenseHandler(w http.ResponseWriter, r *http.Request) {
	var req ExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendErrorResponse(w, "Invalid request", http.StatusBadRequest)
		return
	}

	var expenseDate time.Time
	if req.Date != "" {
		if parsed, err := time.Parse("2006-01-02", req.Date); err == nil {
			expenseDate = parsed
			req.Month = int(parsed.Month())
			req.Year = parsed.Year()
		}
	}

	if expenseDate.IsZero() {
		expenseDate = time.Now()
		if req.Month == 0 {
			req.Month = int(expenseDate.Month())
		}
		if req.Year == 0 {
			req.Year = expenseDate.Year()
		}
	}

	mu.Lock()
	defer mu.Unlock()

	// Use the helper to find the budget for the CUSTOM month/year
	budget := getOrCreateBudget(req.UserID, req.Month, req.Year)

	var bal *float64
	switch req.Category {
	case "Baytul mol":
		bal = &budget.BaytulMol
	case "Oila uchun":
		bal = &budget.OilaUchun
	case "Talim uchun":
		bal = &budget.TalimUchun
	case "Biznes rivoji uchun":
		bal = &budget.BiznesRivoj
	default:
		sendErrorResponse(w, "Invalid category", http.StatusBadRequest)
		return
	}

	if req.Amount > *bal {
		sendErrorResponse(w, fmt.Sprintf("Mablag' yetarli emas! Qolgan: %.0f so'm", *bal), http.StatusBadRequest)
		return
	}

	// Create the expense record
	expense := Expense{
		UserID:      req.UserID,
		Date:        expenseDate,
		Category:    req.Category,
		Amount:      req.Amount,
		Description: req.Description,
	}
	if err := db.Create(&expense).Error; err != nil {
		sendErrorResponse(w, "Failed to create expense", http.StatusInternalServerError)
		return
	}

	// Update the specific monthly balance
	*bal -= req.Amount
	budget.TotalSpent += req.Amount
	if err := db.Save(&budget).Error; err != nil {
		sendErrorResponse(w, "Failed to update budget", http.StatusInternalServerError)
		return
	}

	sendSuccessResponse(w, "Xarajat qo'shildi", map[string]interface{}{
		"expense": expense,
		"budget":  budget,
	})
}
func getExpensesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		sendErrorResponse(w, "User ID required", http.StatusBadRequest)
		return
	}

	uid, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		sendErrorResponse(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	mStr := r.URL.Query().Get("month")
	yStr := r.URL.Query().Get("year")

	var expenses []Expense
	query := db.Where("user_id = ?", uint(uid))

	if mStr != "" && yStr != "" {
		m, _ := strconv.Atoi(mStr)
		y, _ := strconv.Atoi(yStr)
		start := time.Date(y, time.Month(m), 1, 0, 0, 0, 0, time.Local)
		end := start.AddDate(0, 1, 0)
		query = query.Where("date >= ? AND date < ?", start, end)
	} else {
		now := time.Now()
		firstOfCurrentMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		query = query.Where("date >= ?", firstOfCurrentMonth)
	}

	err = query.
		Order("date DESC").
		Find(&expenses).Error

	if err != nil {
		sendErrorResponse(w, "Failed to get expenses", http.StatusInternalServerError)
		return
	}

	sendSuccessResponse(w, "Current month expenses retrieved", expenses)
}
func getStatisticsHandler(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	mStr := r.URL.Query().Get("month")
	yStr := r.URL.Query().Get("year")

	uid, _ := strconv.ParseUint(userID, 10, 32)
	now := time.Now()
	month, year := int(now.Month()), now.Year()

	if mStr != "" {
		month, _ = strconv.Atoi(mStr)
	}
	if yStr != "" {
		year, _ = strconv.Atoi(yStr)
	}

	budget := getOrCreateBudget(uint(uid), month, year)

	var expenses []Expense
	start := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local)
	end := start.AddDate(0, 1, 0)
	db.Where("user_id = ? AND date >= ? AND date < ?", uint(uid), start, end).Find(&expenses)
	categoryTotals := make(map[string]float64)
	for _, expense := range expenses {
		categoryTotals[expense.Category] += expense.Amount
	}

	stats := map[string]interface{}{
		"budget":          budget,
		"category_totals": categoryTotals,
		"total_expenses":  budget.TotalSpent,
		"remaining":       budget.TotalIncome - budget.TotalSpent,
	}

	sendSuccessResponse(w, "Statistika olindi", stats)
}
func getNotesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		sendErrorResponse(w, "User ID required", http.StatusBadRequest)
		return
	}

	uid, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		sendErrorResponse(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var notes []Note
	if err := db.Where("user_id = ?", uint(uid)).Order("created_at DESC").Find(&notes).Error; err != nil {
		sendErrorResponse(w, "Failed to get notes", http.StatusInternalServerError)
		return
	}

	sendSuccessResponse(w, "Eslatmalar olindi", notes)
}
func addNoteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		return
	}

	var req NoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendErrorResponse(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		sendErrorResponse(w, "Content is required", http.StatusBadRequest)
		return
	}

	note := Note{
		UserID:  req.UserID,
		Date:    time.Now(),
		Content: req.Content,
	}

	if err := db.Create(&note).Error; err != nil {
		sendErrorResponse(w, "Failed to create note", http.StatusInternalServerError)
		return
	}

	sendSuccessResponse(w, "Eslatma muvaffaqiyatli qo'shildi!", note)
}
func deleteNoteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		sendErrorResponse(w, "User ID required", http.StatusBadRequest)
		return
	}

	uid, err := strconv.ParseUint(userID, 10, 32)
	if err != nil {
		sendErrorResponse(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	noteID := mux.Vars(r)["id"]

	var note Note
	if err := db.Where("id = ? AND user_id = ?", noteID, uint(uid)).First(&note).Error; err != nil {
		sendErrorResponse(w, "Eslatma topilmadi", http.StatusNotFound)
		return
	}

	if err := db.Delete(&note).Error; err != nil {
		sendErrorResponse(w, "Eslatmani o'chirib bo'lmadi", http.StatusInternalServerError)
		return
	}

	sendSuccessResponse(w, "Eslatma muvaffaqiyatli o'chirildi", nil)
}

// Helper functions
func sendSuccessResponse(w http.ResponseWriter, message string, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(Response{
		Success: true,
		Message: message,
		Data:    data,
	})
}
func getIncomesHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "OPTIONS" {
		return
	}

	userID := r.URL.Query().Get("user_id")
	uid, _ := strconv.ParseUint(userID, 10, 32)

	mStr := r.URL.Query().Get("month")
	yStr := r.URL.Query().Get("year")

	var incs []Income
	query := db.Where("user_id = ?", uint(uid))

	if mStr != "" && yStr != "" {
		m, _ := strconv.Atoi(mStr)
		y, _ := strconv.Atoi(yStr)
		start := time.Date(y, time.Month(m), 1, 0, 0, 0, 0, time.Local)
		end := start.AddDate(0, 1, 0)
		query = query.Where("date >= ? AND date < ?", start, end)
	}

	if err := query.Order("date DESC").Find(&incs).Error; err != nil {
		sendErrorResponse(w, "Failed to retrieve incomes", http.StatusInternalServerError)
		return
	}

	sendSuccessResponse(w, "Incomes retrieved", incs)
}
func sendErrorResponse(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(Response{
		Success: false,
		Message: message,
	})
}
