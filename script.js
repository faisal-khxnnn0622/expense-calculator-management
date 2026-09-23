// ============================================================
// EXPENSE MANAGER - FIREBASE VERSION
// Firebase Authentication + Cloud Firestore
// ============================================================

// -----------------------------
// FIREBASE IMPORTS
// -----------------------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";

import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";


// ============================================================
// FIREBASE CONFIG
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyB3GLhD2H4BQldNNQodvhy_5nlwHoHHeIs",
    authDomain: "expense-calculator-2.firebaseapp.com",
    projectId: "expense-calculator-2",
    storageBucket: "expense-calculator-2.firebasestorage.app",
    messagingSenderId: "651641650417",
    appId: "1:651641650417:web:7ad7dfa9a4bd024db7bd50"
};


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// ============================================================
// GLOBAL HELPERS
// ============================================================

const $ = (id) => document.getElementById(id);

const $$ = (selector) => document.querySelectorAll(selector);


function showMessage(element, message, type = "error") {
    if (!element) return;

    element.textContent = message;
    element.className = `form-message ${type}`;

    element.style.display = "block";
}


function clearMessage(element) {
    if (!element) return;

    element.textContent = "";
    element.style.display = "none";
}


function formatCurrency(amount) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(Number(amount) || 0);
}


function formatDate(dateString) {
    if (!dateString) return "-";

    const date = new Date(dateString + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}


function getToday() {
    const today = new Date();

    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function escapeHTML(value) {
    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function getInitial(name) {
    if (!name) return "U";

    return name
        .trim()
        .charAt(0)
        .toUpperCase();
}


function getCategoryIcon(category) {
    const icons = {
        Food: "🍔",
        Transport: "🚗",
        Shopping: "🛍️",
        Bills: "📄",
        Entertainment: "🎬",
        Health: "❤️",
        Education: "📚",
        Travel: "✈️",
        Salary: "💼",
        Freelance: "💻",
        Business: "🏢",
        Investment: "📈",
        Gift: "🎁",
        Other: "📦"
    };

    return icons[category] || "📦";
}


// ============================================================
// MOBILE SIDEBAR
// ============================================================

function setupMobileSidebar() {
    const sidebar = $("sidebar");
    const mobileButton = $("mobileMenuButton");

    if (!sidebar || !mobileButton) return;

    mobileButton.addEventListener("click", () => {
        sidebar.classList.toggle("active");
    });

    const navLinks = sidebar.querySelectorAll(".nav-link");

    navLinks.forEach((link) => {
        link.addEventListener("click", () => {
            sidebar.classList.remove("active");
        });
    });
}


// ============================================================
// PASSWORD TOGGLES
// ============================================================

function setupPasswordToggle(buttonId, inputId) {
    const button = $(buttonId);
    const input = $(inputId);

    if (!button || !input) return;

    button.addEventListener("click", () => {
        if (input.type === "password") {
            input.type = "text";
            button.textContent = "Hide";
        } else {
            input.type = "password";
            button.textContent = "Show";
        }
    });
}


function setupPasswordToggles() {
    setupPasswordToggle("toggleLoginPassword", "loginPassword");

    setupPasswordToggle(
        "toggleRegisterPassword",
        "registerPassword"
    );

    setupPasswordToggle(
        "toggleConfirmPassword",
        "confirmPassword"
    );

    setupPasswordToggle(
        "toggleCurrentPassword",
        "currentPassword"
    );

    setupPasswordToggle(
        "toggleNewPassword",
        "newPassword"
    );

    setupPasswordToggle(
        "toggleConfirmNewPassword",
        "confirmNewPassword"
    );
}


// ============================================================
// FIREBASE ERROR MESSAGES
// ============================================================

function getFirebaseErrorMessage(error) {
    const code = error?.code || "";

    switch (code) {
        case "auth/invalid-email":
            return "Please enter a valid email address.";

        case "auth/user-not-found":
            return "No account exists with this email.";

        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Incorrect email or password.";

        case "auth/email-already-in-use":
            return "An account already exists with this email.";

        case "auth/weak-password":
            return "Password must be at least 6 characters.";

        case "auth/too-many-requests":
            return "Too many attempts. Please try again later.";

        case "auth/network-request-failed":
            return "Network error. Check your internet connection.";

        case "auth/requires-recent-login":
            return "Please log in again before changing your password.";

        default:
            console.error(error);
            return error?.message || "Something went wrong. Please try again.";
    }
}


// ============================================================
// GET USER PROFILE
// ============================================================

async function getUserProfile(uid) {
    try {
        const userRef = doc(db, "users", uid);
        const snapshot = await getDoc(userRef);

        if (snapshot.exists()) {
            return snapshot.data();
        }

        return null;
    } catch (error) {
        console.error("Profile error:", error);
        return null;
    }
}


// ============================================================
// AUTH PAGE GUARD
// ============================================================

function setupAuthRedirects() {
    const isLoginPage = !!$("loginForm");
    const isRegisterPage = !!$("registerForm");

    if (!isLoginPage && !isRegisterPage) return;

    onAuthStateChanged(auth, (user) => {
        if (user) {
            window.location.href = "dashboard.html";
        }
    });
}


// ============================================================
// LOGIN
// ============================================================

function setupLogin() {
    const form = $("loginForm");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const email = $("loginEmail")?.value.trim();
        const password = $("loginPassword")?.value;
        const rememberMe = $("rememberMe")?.checked;
        const message = $("loginMessage");
        const button = form.querySelector("button[type='submit']");

        clearMessage(message);

        if (!email || !password) {
            showMessage(
                message,
                "Please enter your email and password."
            );
            return;
        }

        try {
            button.disabled = true;
            button.textContent = "Signing in...";

            await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            // Firebase already remembers the session by default.
            // The checkbox is kept as part of the UI.

            if (rememberMe) {
                console.log("Remember me selected.");
            }

            window.location.href = "dashboard.html";

        } catch (error) {
            showMessage(
                message,
                getFirebaseErrorMessage(error)
            );

        } finally {
            button.disabled = false;
            button.textContent = "Sign In";
        }
    });
}


// ============================================================
// FORGOT PASSWORD
// ============================================================

function setupForgotPassword() {
    const button = $("forgotPassword");

    if (!button) return;

    button.addEventListener("click", async (event) => {
        event.preventDefault();

        const emailInput = $("loginEmail");
        const message = $("loginMessage");

        const email = emailInput?.value.trim();

        if (!email) {
            showMessage(
                message,
                "Enter your email address first, then click Forgot password."
            );
            emailInput?.focus();
            return;
        }

        try {
            button.textContent = "Sending...";

            await sendPasswordResetEmail(auth, email);

            showMessage(
                message,
                "Password reset email sent. Check your inbox.",
                "success"
            );

        } catch (error) {
            showMessage(
                message,
                getFirebaseErrorMessage(error)
            );

        } finally {
            button.textContent = "Forgot password?";
        }
    });
}


// ============================================================
// REGISTER
// ============================================================

function setupRegister() {
    const form = $("registerForm");

    if (!form) return;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const fullName = $("fullName")?.value.trim();
        const username = $("username")?.value.trim();
        const email = $("registerEmail")?.value.trim();
        const password = $("registerPassword")?.value;
        const confirmPassword = $("confirmPassword")?.value;
        const terms = $("terms")?.checked;

        const message = $("registerMessage");
        const button = form.querySelector("button[type='submit']");

        clearMessage(message);

        if (!fullName || !username || !email || !password || !confirmPassword) {
            showMessage(
                message,
                "Please fill in all required fields."
            );
            return;
        }

        if (username.length < 3) {
            showMessage(
                message,
                "Username must be at least 3 characters."
            );
            return;
        }

        if (password.length < 6) {
            showMessage(
                message,
                "Password must be at least 6 characters."
            );
            return;
        }

        if (password !== confirmPassword) {
            showMessage(
                message,
                "Passwords do not match."
            );
            return;
        }

        if (!terms) {
            showMessage(
                message,
                "Please accept the terms to continue."
            );
            return;
        }

        try {
            button.disabled = true;
            button.textContent = "Creating account...";

            // Create Firebase Authentication account
            const userCredential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            const user = userCredential.user;

            // Create Firestore user profile
            await setDoc(
                doc(db, "users", user.uid),
                {
                    fullName: fullName,
                    username: username,
                    email: email,
                    accountType: "Personal",
                    createdAt: serverTimestamp()
                }
            );

            showMessage(
                message,
                "Account created successfully! Redirecting...",
                "success"
            );

            setTimeout(() => {
                window.location.href = "dashboard.html";
            }, 700);

        } catch (error) {
            showMessage(
                message,
                getFirebaseErrorMessage(error)
            );

        } finally {
            button.disabled = false;
            button.textContent = "Create Account";
        }
    });
}


// ============================================================
// AUTH GUARD FOR APP PAGES
// ============================================================

function setupAppAuthGuard() {
    const isAppPage =
        !!$("totalBalance") ||
        !!$("expenseForm") ||
        !!$("profileForm");

    if (!isAppPage) return;

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = "index.html";
            return;
        }

        await loadUserHeader(user);
    });
}


// ============================================================
// LOAD USER HEADER
// ============================================================

async function loadUserHeader(user) {
    const profile = await getUserProfile(user.uid);

    const name =
        profile?.fullName ||
        user.displayName ||
        user.email?.split("@")[0] ||
        "User";

    const initial = getInitial(name);

    const userInitial = $("userInitial");
    const headerUserName = $("headerUserName");

    if (userInitial) {
        userInitial.textContent = initial;
    }

    if (headerUserName) {
        headerUserName.textContent = name;
    }

    // Profile page
    if ($("profileDisplayName")) {
        $("profileDisplayName").textContent = name;
    }

    if ($("profileUsername")) {
        $("profileUsername").textContent =
            profile?.username
                ? `@${profile.username}`
                : "@user";
    }

    if ($("profileEmail")) {
        $("profileEmail").textContent =
            profile?.email || user.email || "";
    }

    if ($("profileFullName")) {
        $("profileFullName").value =
            profile?.fullName || name;
    }

    if ($("profileUsernameInput")) {
        $("profileUsernameInput").value =
            profile?.username || "";
    }

    if ($("profileEmailInput")) {
        $("profileEmailInput").value =
            profile?.email || user.email || "";
    }

    if ($("accountType")) {
        $("accountType").textContent =
            profile?.accountType || "Personal";
    }

    if ($("accountStatus")) {
        $("accountStatus").textContent = "Active";
    }

    if ($("memberSince")) {
        let memberDate = "-";

        if (profile?.createdAt?.toDate) {
            memberDate = profile.createdAt
                .toDate()
                .toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                });
        }

        $("memberSince").textContent = memberDate;
    }

    if ($("profileAvatar")) {
        $("profileAvatar").textContent = initial;
    }
}


// ============================================================
// EXPENSE COLLECTION
// ============================================================

function expensesCollection(uid) {
    return collection(
        db,
        "users",
        uid,
        "expenses"
    );
}


// ============================================================
// ADD EXPENSE / INCOME
// ============================================================

function setupExpenseForm() {
    const form = $("expenseForm");

    if (!form) return;

    const dateInput = $("transactionDate");

    if (dateInput && !dateInput.value) {
        dateInput.value = getToday();
    }

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        const user = auth.currentUser;

        if (!user) {
            window.location.href = "index.html";
            return;
        }

        const type = $("transactionType")?.value;
        const title = $("transactionTitle")?.value.trim();
        const amount = Number(
            $("transactionAmount")?.value
        );
        const category = $("transactionCategory")?.value;
        const date = $("transactionDate")?.value;
        const notes = $("transactionNotes")?.value.trim();

        const message = $("transactionMessage");
        const button = form.querySelector("button[type='submit']");

        clearMessage(message);

        if (!type || !title || !amount || !category || !date) {
            showMessage(
                message,
                "Please fill in all required fields."
            );
            return;
        }

        if (amount <= 0) {
            showMessage(
                message,
                "Amount must be greater than zero."
            );
            return;
        }

        try {
            button.disabled = true;
            button.textContent = "Saving...";

            await addDoc(
                expensesCollection(user.uid),
                {
                    type: type,
                    title: title,
                    amount: amount,
                    category: category,
                    date: date,
                    notes: notes,
                    createdAt: serverTimestamp()
                }
            );

            showMessage(
                message,
                "Transaction saved successfully!",
                "success"
            );

            form.reset();

            if (dateInput) {
                dateInput.value = getToday();
            }

        } catch (error) {
            console.error(error);

            showMessage(
                message,
                "Unable to save transaction. Please try again."
            );

        } finally {
            button.disabled = false;
            button.textContent = "Save Transaction";
        }
    });
}


// ============================================================
// GET ALL USER EXPENSES
// ============================================================

async function getUserExpenses(uid) {
    try {
        const snapshot = await getDocs(
            expensesCollection(uid)
        );

        const transactions = [];

        snapshot.forEach((documentSnapshot) => {
            transactions.push({
                id: documentSnapshot.id,
                ...documentSnapshot.data()
            });
        });

        transactions.sort((a, b) => {
            const dateA = new Date(
                (a.date || "1900-01-01") + "T00:00:00"
            );

            const dateB = new Date(
                (b.date || "1900-01-01") + "T00:00:00"
            );

            return dateB - dateA;
        });

        return transactions;

    } catch (error) {
        console.error("Error loading expenses:", error);
        return [];
    }
}


// ============================================================
// DASHBOARD
// ============================================================

async function setupDashboard() {
    if (!$("totalBalance")) return;

    const user = auth.currentUser;

    if (!user) return;

    const transactions = await getUserExpenses(user.uid);

    let totalIncome = 0;
    let totalExpense = 0;

    transactions.forEach((transaction) => {
        const amount = Number(transaction.amount) || 0;

        if (transaction.type === "income") {
            totalIncome += amount;
        } else {
            totalExpense += amount;
        }
    });

    const balance = totalIncome - totalExpense;

    if ($("totalBalance")) {
        $("totalBalance").textContent =
            formatCurrency(balance);
    }

    if ($("totalIncome")) {
        $("totalIncome").textContent =
            formatCurrency(totalIncome);
    }

    if ($("totalExpense")) {
        $("totalExpense").textContent =
            formatCurrency(totalExpense);
    }

    if ($("transactionCount")) {
        $("transactionCount").textContent =
            transactions.length;
    }

    renderRecentTransactions(transactions);
    renderCategories(transactions);
    renderSpendingChart(transactions);

    if ($("currentDate")) {
        $("currentDate").textContent =
            new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            });
    }
}


// ============================================================
// RECENT TRANSACTIONS
// ============================================================

function renderRecentTransactions(transactions) {
    const container = $("recentTransactions");

    if (!container) return;

    const recent = transactions.slice(0, 5);

    if (recent.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💸</div>
                <h3>No transactions yet</h3>
                <p>Add your first income or expense to get started.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = recent.map((transaction) => {
        const isIncome = transaction.type === "income";

        return `
            <div class="transaction-row">
                <div class="transaction-row-left">
                    <div class="category-icon">
                        ${getCategoryIcon(transaction.category)}
                    </div>

                    <div>
                        <div class="transaction-name">
                            ${escapeHTML(transaction.title)}
                        </div>

                        <div class="transaction-description">
                            ${escapeHTML(transaction.category)}
                            ·
                            ${formatDate(transaction.date)}
                        </div>
                    </div>
                </div>

                <div class="${isIncome ? "income-text" : "expense-text"}">
                    ${isIncome ? "+" : "-"}${formatCurrency(transaction.amount)}
                </div>
            </div>
        `;
    }).join("");
}


// ============================================================
// CATEGORY SUMMARY
// ============================================================

function renderCategories(transactions) {
    const container = $("categoryList");

    if (!container) return;

    const categoryTotals = {};

    transactions
        .filter((transaction) => transaction.type === "expense")
        .forEach((transaction) => {
            const category = transaction.category || "Other";

            categoryTotals[category] =
                (categoryTotals[category] || 0) +
                Number(transaction.amount || 0);
        });

    const categories = Object.entries(categoryTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);

    if (categories.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📊</div>
                <p>No expense categories yet.</p>
            </div>
        `;
        return;
    }

    const maxAmount = categories[0][1];

    container.innerHTML = categories.map(
        ([category, amount]) => {
            const percentage =
                maxAmount > 0
                    ? (amount / maxAmount) * 100
                    : 0;

            return `
                <div class="category-item">

                    <div class="category-icon">
                        ${getCategoryIcon(category)}
                    </div>

                    <div class="category-name">
                        ${escapeHTML(category)}
                    </div>

                    <div class="category-bar">
                        <div
                            class="category-bar-fill"
                            style="width: ${percentage}%"
                        ></div>
                    </div>

                    <div class="category-amount">
                        ${formatCurrency(amount)}
                    </div>

                </div>
            `;
        }
    ).join("");
}


// ============================================================
// SIMPLE SPENDING CHART
// ============================================================

function renderSpendingChart(transactions) {
    const chart = $("spendingChart");

    if (!chart) return;

    const expenses = transactions
        .filter((transaction) => transaction.type === "expense")
        .slice(0, 7)
        .reverse();

    if (expenses.length === 0) {
        chart.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📈</div>
                <h3>No spending data</h3>
                <p>Your spending chart will appear here.</p>
            </div>
        `;
        return;
    }

    const maxAmount = Math.max(
        ...expenses.map(
            (transaction) => Number(transaction.amount) || 0
        )
    );

    chart.innerHTML = `
        <div style="
            display:flex;
            align-items:flex-end;
            gap:12px;
            height:220px;
            padding:20px 10px;
        ">
            ${expenses.map((transaction) => {
                const amount =
                    Number(transaction.amount) || 0;

                const height =
                    maxAmount > 0
                        ? Math.max(
                            8,
                            (amount / maxAmount) * 160
                        )
                        : 8;

                return `
                    <div style="
                        flex:1;
                        height:100%;
                        display:flex;
                        flex-direction:column;
                        justify-content:flex-end;
                        align-items:center;
                        gap:7px;
                    ">

                        <span style="
                            font-size:11px;
                            color:#64748B;
                            white-space:nowrap;
                        ">
                            ${formatCurrency(amount)}
                        </span>

                        <div style="
                            width:100%;
                            max-width:42px;
                            height:${height}px;
                            background:#0F766E;
                            border-radius:8px 8px 3px 3px;
                        "></div>

                        <span style="
                            font-size:10px;
                            color:#64748B;
                        ">
                            ${formatDate(transaction.date)
                                .split(" ")
                                .slice(0, 2)
                                .join(" ")}
                        </span>

                    </div>
                `;
            }).join("")}
        </div>
    `;
}


// ============================================================
// EXPENSES PAGE
// ============================================================

let allTransactions = [];


async function setupExpensesPage() {
    if (!$("transactionsTableBody")) return;

    const user = auth.currentUser;

    if (!user) return;

    allTransactions = await getUserExpenses(user.uid);

    renderTransactionsTable(allTransactions);

    setupExpenseFilters();
}


// ============================================================
// RENDER TRANSACTION TABLE
// ============================================================

function renderTransactionsTable(transactions) {
    const tableBody = $("transactionsTableBody");
    const emptyState = $("transactionsEmptyState");

    if (!tableBody) return;

    if (transactions.length === 0) {
        tableBody.innerHTML = "";

        if (emptyState) {
            emptyState.style.display = "block";
        }

        return;
    }

    if (emptyState) {
        emptyState.style.display = "none";
    }

    tableBody.innerHTML = transactions.map(
        (transaction) => {
            const isIncome =
                transaction.type === "income";

            return `
                <tr>

                    <td>
                        <div class="transaction-name">
                            ${escapeHTML(transaction.title)}
                        </div>

                        ${
                            transaction.notes
                                ? `
                                <div class="transaction-description">
                                    ${escapeHTML(transaction.notes)}
                                </div>
                                `
                                : ""
                        }
                    </td>

                    <td>
                        <span class="transaction-category">
                            ${getCategoryIcon(transaction.category)}
                            ${escapeHTML(transaction.category)}
                        </span>
                    </td>

                    <td>
                        <span class="transaction-date">
                            ${formatDate(transaction.date)}
                        </span>
                    </td>

                    <td>
                        <span class="${isIncome ? "income-text" : "expense-text"}">
                            ${isIncome ? "+" : "-"}${formatCurrency(transaction.amount)}
                        </span>
                    </td>

                    <td>
                        <span class="type-badge ${isIncome ? "income" : "expense"}">
                            ${isIncome ? "Income" : "Expense"}
                        </span>
                    </td>

                    <td>
                        <button
                            class="table-action"
                            data-delete-id="${transaction.id}"
                            type="button"
                        >
                            Delete
                        </button>
                    </td>

                </tr>
            `;
        }
    ).join("");

    const deleteButtons =
        tableBody.querySelectorAll("[data-delete-id]");

    deleteButtons.forEach((button) => {
        button.addEventListener("click", async () => {
            const id = button.dataset.deleteId;

            await deleteTransaction(id);
        });
    });
}


// ============================================================
// DELETE TRANSACTION
// ============================================================

async function deleteTransaction(transactionId) {
    const user = auth.currentUser;

    if (!user) return;

    const confirmed = confirm(
        "Are you sure you want to delete this transaction?"
    );

    if (!confirmed) return;

    try {
        await deleteDoc(
            doc(
                db,
                "users",
                user.uid,
                "expenses",
                transactionId
            )
        );

        allTransactions =
            allTransactions.filter(
                (transaction) =>
                    transaction.id !== transactionId
            );

        applyTransactionFilters();

    } catch (error) {
        console.error(error);
        alert("Unable to delete transaction.");
    }
}


// ============================================================
// FILTERS
// ============================================================

function setupExpenseFilters() {
    const search = $("transactionSearch");
    const category = $("categoryFilter");
    const type = $("typeFilter");
    const date = $("dateFilter");
    const clear = $("clearFilters");

    if (search) {
        search.addEventListener(
            "input",
            applyTransactionFilters
        );
    }

    if (category) {
        category.addEventListener(
            "change",
            applyTransactionFilters
        );
    }

    if (type) {
        type.addEventListener(
            "change",
            applyTransactionFilters
        );
    }

    if (date) {
        date.addEventListener(
            "change",
            applyTransactionFilters
        );
    }

    if (clear) {
        clear.addEventListener("click", () => {
            if (search) search.value = "";
            if (category) category.value = "";
            if (type) type.value = "";
            if (date) date.value = "";

            applyTransactionFilters();
        });
    }
}


function applyTransactionFilters() {
    const search =
        $("transactionSearch")?.value
            .trim()
            .toLowerCase() || "";

    const category =
        $("categoryFilter")?.value || "";

    const type =
        $("typeFilter")?.value || "";

    const date =
        $("dateFilter")?.value || "";

    const filtered = allTransactions.filter(
        (transaction) => {

            const matchesSearch =
                !search ||
                transaction.title
                    ?.toLowerCase()
                    .includes(search) ||
                transaction.notes
                    ?.toLowerCase()
                    .includes(search) ||
                transaction.category
                    ?.toLowerCase()
                    .includes(search);

            const matchesCategory =
                !category ||
                transaction.category === category;

            const matchesType =
                !type ||
                transaction.type === type;

            const matchesDate =
                !date ||
                transaction.date === date;

            return (
                matchesSearch &&
                matchesCategory &&
                matchesType &&
                matchesDate
            );
        }
    );

    renderTransactionsTable(filtered);
}


// ============================================================
// PROFILE PAGE
// ============================================================

function setupProfile() {
    const profileForm = $("profileForm");

    if (profileForm) {
        profileForm.addEventListener(
            "submit",
            updateProfile
        );
    }

    const passwordForm = $("passwordForm");

    if (passwordForm) {
        passwordForm.addEventListener(
            "submit",
            changePassword
        );
    }

    const logoutButton = $("profileLogoutButton");

    if (logoutButton) {
        logoutButton.addEventListener(
            "click",
            logoutUser
        );
    }
}


// ============================================================
// UPDATE PROFILE
// ============================================================

async function updateProfile(event) {
    event.preventDefault();

    const user = auth.currentUser;

    if (!user) return;

    const fullName =
        $("profileFullName")?.value.trim();

    const username =
        $("profileUsernameInput")?.value.trim();

    const message = $("profileMessage");

    clearMessage(message);

    if (!fullName || !username) {
        showMessage(
            message,
            "Full name and username are required."
        );
        return;
    }

    try {
        const button =
            event.target.querySelector(
                "button[type='submit']"
            );

        if (button) {
            button.disabled = true;
            button.textContent = "Saving...";
        }

        await setDoc(
            doc(db, "users", user.uid),
            {
                fullName: fullName,
                username: username,
                email: user.email
            },
            {
                merge: true
            }
        );

        showMessage(
            message,
            "Profile updated successfully!",
            "success"
        );

        await loadUserHeader(user);

    } catch (error) {
        console.error(error);

        showMessage(
            message,
            "Unable to update profile."
        );

    } finally {
        const button =
            event.target.querySelector(
                "button[type='submit']"
            );

        if (button) {
            button.disabled = false;
            button.textContent = "Save Changes";
        }
    }
}


// ============================================================
// CHANGE PASSWORD
// ============================================================

async function changePassword(event) {
    event.preventDefault();

    const user = auth.currentUser;

    if (!user || !user.email) return;

    const currentPassword =
        $("currentPassword")?.value;

    const newPassword =
        $("newPassword")?.value;

    const confirmPassword =
        $("confirmNewPassword")?.value;

    const message = $("passwordMessage");

    clearMessage(message);

    if (!currentPassword || !newPassword || !confirmPassword) {
        showMessage(
            message,
            "Please fill in all password fields."
        );
        return;
    }

    if (newPassword.length < 6) {
        showMessage(
            message,
            "New password must be at least 6 characters."
        );
        return;
    }

    if (newPassword !== confirmPassword) {
        showMessage(
            message,
            "New passwords do not match."
        );
        return;
    }

    try {
        const button =
            event.target.querySelector(
                "button[type='submit']"
            );

        if (button) {
            button.disabled = true;
            button.textContent = "Updating...";
        }

        // Re-authenticate the user
        const credential =
            EmailAuthProvider.credential(
                user.email,
                currentPassword
            );

        await reauthenticateWithCredential(
            user,
            credential
        );

        // Update password
        await updatePassword(
            user,
            newPassword
        );

        showMessage(
            message,
            "Password changed successfully!",
            "success"
        );

        event.target.reset();

    } catch (error) {
        console.error(error);

        showMessage(
            message,
            getFirebaseErrorMessage(error)
        );

    } finally {
        const button =
            event.target.querySelector(
                "button[type='submit']"
            );

        if (button) {
            button.disabled = false;
            button.textContent = "Change Password";
        }
    }
}


// ============================================================
// LOGOUT
// ============================================================

async function logoutUser() {
    try {
        await signOut(auth);

        window.location.href = "index.html";

    } catch (error) {
        console.error("Logout error:", error);
    }
}


function setupLogoutButtons() {
    const logoutButtons =
        $$("[id='logoutButton']");

    logoutButtons.forEach((button) => {
        button.addEventListener(
            "click",
            logoutUser
        );
    });
}


// ============================================================
// NAVIGATION
// ============================================================

function setupNavigation() {
    const addExpenseButtons =
        $$("[data-add-expense]");

    addExpenseButtons.forEach((button) => {
        button.addEventListener("click", () => {
            window.location.href = "expenses.html";
        });
    });
}


// ============================================================
// DASHBOARD QUICK ACTIONS
// ============================================================

function setupQuickActions() {
    const buttons =
        $$(".quick-action");

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            const target =
                button.dataset.target;

            if (target) {
                window.location.href = target;
            }
        });
    });
}


// ============================================================
// CHART PERIOD
// ============================================================

function setupChartPeriod() {
    const select = $("chartPeriod");

    if (!select) return;

    select.addEventListener("change", async () => {
        const user = auth.currentUser;

        if (!user) return;

        const transactions =
            await getUserExpenses(user.uid);

        renderSpendingChart(transactions);
    });
}


// ============================================================
// INITIALIZE APP
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupMobileSidebar();

        setupPasswordToggles();

        setupAuthRedirects();

        setupLogin();

        setupForgotPassword();

        setupRegister();

        setupAppAuthGuard();

        setupExpenseForm();

        setupExpensesPage();

        setupProfile();

        setupLogoutButtons();

        setupNavigation();

        setupQuickActions();

        setupChartPeriod();

        // Dashboard loads after Firebase auth is ready
        onAuthStateChanged(auth, async (user) => {

            if (!user) return;

            if ($("totalBalance")) {
                await setupDashboard();
            }

            if ($("transactionsTableBody")) {
                await setupExpensesPage();
            }

            if ($("profileForm")) {
                await loadUserHeader(user);
            }
        });
    }
);