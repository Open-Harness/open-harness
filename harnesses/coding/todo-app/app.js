/**
 * TODO Application
 * A simple, clean todo list application with add, complete, and delete functionality
 */

// ============================================
// State Management
// ============================================
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
        todoInput.focus();
        return;
    }

    const todo = createTodo(text);
    todos.push(todo);

    todoInput.value = '';
    todoInput.focus();

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
        render();
    }
}

/**
 * Deletes a todo from the list
 * @param {number} id - The todo ID
 */
function deleteTodo(id) {
    todos = todos.filter(t => t.id !== id);
    render();
}

/**
 * Clears all completed todos
 */
function clearCompleted() {
    todos = todos.filter(t => !t.completed);
    render();
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

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => toggleTodo(todo.id));

    // Text
    const text = document.createElement('span');
    text.className = 'todo-text';
    text.textContent = todo.text;

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('aria-label', 'Delete todo');
    deleteBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
    `;
    deleteBtn.addEventListener('click', () => deleteTodo(todo.id));

    li.appendChild(checkbox);
    li.appendChild(text);
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

// Add todo on button click
addBtn.addEventListener('click', addTodo);

// Add todo on Enter key
todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addTodo();
    }
});

// Clear completed todos
clearCompletedBtn.addEventListener('click', clearCompleted);

// ============================================
// Initialization
// ============================================

/**
 * Initialize the application
 */
function init() {
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
