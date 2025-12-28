/**
 * TODO Application
 * A simple, clean todo list application with add, complete, and delete functionality
 */

// ============================================
// State Management
// ============================================
const STORAGE_KEY = 'todos-app-data';
let todos = [];
let nextId = 1;

// ============================================
// DOM Elements
// ============================================
const todoInput = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const todoCount = document.querySelector('.todo-count');
const clearCompletedBtn = document.getElementById('clear-completed');

// ============================================
// Local Storage Functions
// ============================================

/**
 * Loads todos from localStorage
 */
function loadFromStorage() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const data = JSON.parse(stored);
            todos = data.todos || [];
            nextId = data.nextId || 1;
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        todos = [];
        nextId = 1;
    }
}

/**
 * Saves todos to localStorage
 */
function saveToStorage() {
    try {
        const data = {
            todos,
            nextId
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

// ============================================
// Core Functions
// ============================================

/**
 * Creates a new todo item object
 * @param {string} text - The todo text
 * @returns {Object} Todo item
 */
function createTodo(text) {
    return {
        id: nextId++,
        text: text.trim(),
        completed: false,
        createdAt: new Date().toISOString()
    };
}

/**
 * Adds a new todo to the list
 */
function addTodo() {
    const text = todoInput.value.trim();

    if (!text) {
        // Add shake animation to empty input
        todoInput.classList.add('shake');
        setTimeout(() => todoInput.classList.remove('shake'), 500);
        todoInput.focus();
        return;
    }

    const todo = createTodo(text);
    todos.push(todo);

    todoInput.value = '';
    todoInput.focus();

    saveToStorage();
    render();
}

/**
 * Toggles the completed status of a todo
 * @param {number} id - The todo ID
 */
function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveToStorage();
        render();
    }
}

/**
 * Deletes a todo from the list
 * @param {number} id - The todo ID
 */
function deleteTodo(id) {
    const todoElement = document.querySelector(`[data-id="${id}"]`);
    if (todoElement) {
        // Add fade-out animation
        todoElement.classList.add('fade-out');
        setTimeout(() => {
            todos = todos.filter(t => t.id !== id);
            saveToStorage();
            render();
        }, 300);
    } else {
        todos = todos.filter(t => t.id !== id);
        saveToStorage();
        render();
    }
}

/**
 * Clears all completed todos
 */
function clearCompleted() {
    const completedItems = document.querySelectorAll('.todo-item.completed');
    if (completedItems.length > 0) {
        // Add fade-out animation to all completed items
        completedItems.forEach(item => item.classList.add('fade-out'));
        setTimeout(() => {
            todos = todos.filter(t => !t.completed);
            saveToStorage();
            render();
        }, 300);
    } else {
        todos = todos.filter(t => !t.completed);
        saveToStorage();
        render();
    }
}

// ============================================
// Rendering
// ============================================

/**
 * Creates a DOM element for a todo item
 * @param {Object} todo - The todo object
 * @returns {HTMLElement} The todo list item element
 */
function createTodoElement(todo) {
    const li = document.createElement('li');
    li.className = `todo-item${todo.completed ? ' completed' : ''}`;
    li.dataset.id = todo.id;
    li.setAttribute('role', 'listitem');

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.id = `todo-${todo.id}`;
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-label', `Mark "${todo.text}" as ${todo.completed ? 'incomplete' : 'complete'}`);
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    // Text (wrapped in label for better accessibility)
    const label = document.createElement('label');
    label.className = 'todo-text';
    label.htmlFor = `todo-${todo.id}`;
    label.textContent = todo.text;

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', `Delete "${todo.text}"`);
    deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
    `;
    deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

    // Keyboard navigation for delete button
    deleteBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            deleteTodo(todo.id);
        }
    });

    li.appendChild(checkbox);
    li.appendChild(label);
    li.appendChild(deleteBtn);

    return li;
}

/**
 * Updates the todo count display
 */
function updateCount() {
    const activeCount = todos.filter(t => !t.completed).length;
    const total = todos.length;

    if (total === 0) {
        todoCount.textContent = '0 tasks';
    } else if (activeCount === total) {
        todoCount.textContent = `${total} ${total === 1 ? 'task' : 'tasks'}`;
    } else {
        todoCount.textContent = `${activeCount} of ${total} ${total === 1 ? 'task' : 'tasks'}`;
    }
}

/**
 * Main render function - updates the entire UI
 */
function render() {
    // Clear the list
    todoList.innerHTML = '';

    // Show/hide empty state
    if (todos.length === 0) {
        emptyState.classList.add('visible');
        clearCompletedBtn.disabled = true;
    } else {
        emptyState.classList.remove('visible');

        // Render todos
        todos.forEach(todo => {
            const todoElement = createTodoElement(todo);
            todoList.appendChild(todoElement);
        });

        // Update clear button state
        const hasCompleted = todos.some(t => t.completed);
        clearCompletedBtn.disabled = !hasCompleted;
    }

    // Update count
    updateCount();
}

// ============================================
// Event Listeners
// ============================================

// Add todo on form submission
const inputForm = document.querySelector('.input-section');
inputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    addTodo();
});

// Clear completed todos
clearCompletedBtn.addEventListener('click', clearCompleted);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Focus input with Ctrl/Cmd + K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        todoInput.focus();
        todoInput.select();
    }
});

// ============================================
// Initialization
// ============================================

/**
 * Initialize the application
 */
function init() {
    loadFromStorage();
    render();
    todoInput.focus();
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ============================================
// Exports (for testing)
// ============================================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createTodo,
        addTodo,
        toggleTodo,
        deleteTodo,
        clearCompleted,
        todos
    };
}
