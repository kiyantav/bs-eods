const loginBtn = document.getElementById("login-btn");
const shopSelect = document.getElementById("shop-select");
const passwordInput = document.getElementById("password");
const loginView = document.getElementById("login-view");
const formView = document.getElementById("form-view");
const adminView = document.getElementById("admin-view");
const barberListDiv = document.getElementById("barber-list");
const dailyForm = document.getElementById("daily-form");

window.addEventListener("load", () => {
  const loadingModal = document.getElementById("loading-modal");
  loadingModal.style.display = "none"; // Hide the spinner
});

// Remember password logic
if (localStorage.getItem("bs_password")) {
  passwordInput.value = localStorage.getItem("bs_password");
  document.getElementById("remember-password").checked = true;
}

// Password toggle
const togglePasswordBtn = document.getElementById("toggle-password");
togglePasswordBtn.addEventListener("click", () => {
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    togglePasswordBtn.innerHTML = '<i class="fi fi-sr-eye-crossed"></i>';
  } else {
    passwordInput.type = "password";
    togglePasswordBtn.innerHTML = '<i class="fi fi-ss-eye"></i>';
  }
});

// Auto-focus and Enter key support
passwordInput.focus();
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loginBtn.click();
});

let demoLogs = [];
let shopsMap = {};
let barbersByShopMap = {}; 

// Login logic
loginBtn.addEventListener("click", async () => {
  const shop = shopSelect.value;
  const password = passwordInput.value;
  const loginFeedback = document.getElementById("login-feedback");
  const loadingModal = document.getElementById("loading-modal"); // Reference the spinner modal

  loginFeedback.className = "feedback error";
  passwordInput.classList.remove("input-error");

  // Show the spinner before any validation
  loadingModal.style.display = "flex";

  if (!password) {
    loginFeedback.textContent = "Please enter your password.";
    loginFeedback.style.display = "block";
    passwordInput.classList.add("input-error");
    loadingModal.style.display = "none"; // Hide the spinner if validation fails
    return;
  }

  if (document.getElementById("remember-password").checked) {
    localStorage.setItem("bs_password", passwordInput.value);
  } else {
    localStorage.removeItem("bs_password");
  }

  // Hide feedback before starting login
  loginFeedback.style.display = "none";
  loginFeedback.textContent = "";

  try {
    const response = await fetch("/api/barber-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const result = await response.json();

    if (result.success) {
      loginFeedback.style.display = "none";
      loginFeedback.textContent = "";
      loginFeedback.style.color = "";

      // Store shop/barber data
      shopsMap = {};
      barbersByShopMap = {};

      result.shops.forEach(s => shopsMap[s.name] = s.id);
      result.barbers.forEach(b => {
        const shopEntry = Object.entries(shopsMap).find(([, id]) => id === b.shop_id);
        const shopName = shopEntry ? shopEntry[0] : 'unknown';
        barbersByShopMap[shopName] = barbersByShopMap[shopName] || [];
        barbersByShopMap[shopName].push({ id: b.id, name: b.name, dayRate: b.day_rate });
      });

      // Check if admin
      const adminResponse = await fetch("/api/admin-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });

      if (adminResponse.ok) {
        // Admin login
        openAdminView(password);
      } else {
        // Barber login
        loginView.style.display = "none";
        formView.style.display = "block";
        populateBarberInputs(shop);
        document.getElementById("date").value = new Date().toISOString().slice(0,10);
      }
    } else {
      loginFeedback.textContent = "Incorrect password. Please try again.";
      loginFeedback.style.display = "block";
      passwordInput.classList.add("input-error");
    }
  } catch (error) {
    loginFeedback.textContent = "Connection error. Please try again.";
    loginFeedback.style.display = "block";
    passwordInput.classList.add("input-error");
  } finally {
    loadingModal.style.display = "none"; // Always hide the spinner
  }
});

// Admin dashboard
async function openAdminView(password) {
  try {
    const response = await fetch("/api/admin-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password })
    });
    const result = await response.json();

    if (result.success) {
      // Normalize logs data
      demoLogs = (result.logs || []).map(r => ({
        id: r.id,
        date: r.date,
        shop: r.shops?.name || '',
        shop_id: r.shops?.id || null,
        barberName: r.barbers?.name || '',
        barber_id: r.barbers?.id || null,
        cashTotal: r.cash_total,
        cashFloat: r.cash_float,
        notes: r.notes,
        haircuts: Number(r.haircuts)
      }));

      loginView.style.display = "none";
      adminView.style.display = "block";
      renderAdminDashboard();
    }
  } catch (error) {
    console.error("Error fetching admin data:", error);
  }
}

// Form submission
dailyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const feedback = document.getElementById("form-feedback");
  feedback.textContent = "";

  const shopName = shopSelect.value;
  const date = document.getElementById("date").value;
  const cashTotal = document.getElementById("cash-total").value;
  const cashFloat = document.getElementById("cash-float").value;

  if (!date || !cashTotal || !cashFloat) {
    feedback.textContent = "Please fill in all required fields.";
    return;
  }

  const barberInputs = [
    ...barberListDiv.querySelectorAll("input[type='number']"),
    ...document.getElementById("other-barbers-list").querySelectorAll("input[type='number']")
  ];

  const rowsToInsert = [];
  barberInputs.forEach(input => {
    const val = input.value;
    const haircuts = val === "" ? 0 : Number(val);
    if (haircuts > 0) {
      const barberId = input.dataset.barberId || null;
      const barberName = input.dataset.barberName;
      let finalBarberId = barberId;
      
      if (!finalBarberId) {
        const arr = (barbersByShopMap[shopName] || []).filter(b => b.name === barberName);
        if (arr.length) finalBarberId = arr[0].id;
      }
      
      rowsToInsert.push({
        shop_id: shopsMap[shopName],
        barber_id: finalBarberId,
        date,
        cash_total: Number(cashTotal),
        cash_float: Number(cashFloat),
        notes: document.getElementById("notes").value || '',
        haircuts
      });
    }
  });

  if (rowsToInsert.length === 0) {
    feedback.textContent = "Please enter at least one haircut for a barber.";
    return;
  }

  showConfirmationModal(rowsToInsert);
});

// Confirmation modal
function showConfirmationModal(rowsToInsert) {
  const modal = document.getElementById("confirmation-modal");
  const summaryDiv = document.getElementById("confirmation-summary");
  modal.style.display = "flex";

  summaryDiv.innerHTML = `
    <strong>Date:</strong> ${document.getElementById("date").value}<br>
    <strong>Cash Total:</strong> £${document.getElementById("cash-total").value}<br>
    <strong>Cash Float:</strong> £${document.getElementById("cash-float").value}<br>
    <strong>Notes:</strong> ${document.getElementById("notes").value || "-"}<br>
    <hr>
    <strong>Barber Haircuts:</strong>
    <ul style="margin:0; padding-left:1.2em;">
      ${rowsToInsert.map(r => `<li>${getBarberNameById(r.barber_id) || r.barberName}: <strong>${r.haircuts}</strong></li>`).join("")}
    </ul>
  `;

  document.getElementById("confirm-no").onclick = () => {
    modal.style.display = "none";
  };

  document.getElementById("confirm-yes").onclick = async () => {
    modal.style.display = "none";
    
    try {
      const response = await fetch("/api/submit-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          password: passwordInput.value, 
          reportData: rowsToInsert 
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        dailyForm.reset();
        document.getElementById("date").value = new Date().toISOString().slice(0,10);
        
        const successModal = document.getElementById("success-modal");
        successModal.style.display = "flex";
        document.getElementById("success-ok").onclick = () => {
          successModal.style.display = "none";
        };
      } else {
        const feedback = document.getElementById("form-feedback");
        feedback.textContent = result.error || "Error saving data.";
        feedback.style.color = "red";
      }
    } catch (error) {
      const feedback = document.getElementById("form-feedback");
      feedback.textContent = "Connection error. Please try again.";
      feedback.style.color = "red";
    }
  };
}

// Utility functions
function calculateCommission(haircuts) {
  if (haircuts >= 15) return 40;
  if (haircuts >= 13) return 30;
  if (haircuts >= 10) return 10;
  return 0;
}

function getMonday(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff)).toISOString().slice(0,10);
}

function calculateWeeklySummary(logs) {
  const shopFilter = document.getElementById("admin-shop-filter")?.value;
  const summary = {};

  logs.forEach(log => {
    const weekStart = getMonday(log.date);
    const key = shopFilter
      ? `${log.barberName}_${weekStart}` 
      : `${log.barberName}_${weekStart}`;

    if (!summary[key]) {
      // Find the barber's day rate from any shop
      let dayRate = 0;
      for (const shop in barbersByShopMap) {
        const found = barbersByShopMap[shop].find(b => b.name === log.barberName);
        if (found) {
          dayRate = found.dayRate;
          break;
        }
      }
      summary[key] = {
        barberName: log.barberName,
        shop: log.shop,
        weekStart,
        totalHaircuts: 0,
        totalCommission: 0,
        daysWorked: new Set(),
        totalPay: 0,
        dayRate: dayRate // Always the same for the barber
      };
    }
    summary[key].totalHaircuts += log.haircuts;
    summary[key].totalCommission += calculateCommission(log.haircuts);
    summary[key].daysWorked.add(log.date);
  });

  Object.values(summary).forEach(entry => {
    const daysWorkedCount = entry.daysWorked.size;
    const dayRatePay = daysWorkedCount * entry.dayRate;
    entry.totalPay = dayRatePay + entry.totalCommission;
  });

  return Object.values(summary);
}

function getBarberNameById(id) {
  for (const shop in barbersByShopMap) {
    const found = barbersByShopMap[shop].find(b => b.id == id);
    if (found) return found.name;
  }
  return "Unknown";
}

function populateBarberInputs(shopName) {
  barberListDiv.innerHTML = "";
  const list = barbersByShopMap[shopName] || [];
  
  list.forEach(barber => {
    const barberDiv = document.createElement("div");
    barberDiv.className = "barber-input";
    barberDiv.innerHTML = `
      <div class="barber-name">${barber.name}</div>
      <input 
        type="number" 
        min="0" 
        step="0.5" 
        placeholder="0"
        data-barber-id="${barber.id || ''}"
        data-barber-name="${barber.name}"
        name="haircuts_${barber.name}"
      >
    `;
    
    const input = barberDiv.querySelector('input');
    input.addEventListener('input', () => {
      if (input.value && parseFloat(input.value) > 0) {
        barberDiv.classList.add('has-value');
      } else {
        barberDiv.classList.remove('has-value');
      }
    });
    
    barberListDiv.appendChild(barberDiv);
  });

  populateOtherBarberSelect(shopName);
}

function updateCashSummary(logs = demoLogs) {
  const shopFilter = document.getElementById("admin-shop-filter").value;
  const tbody = document.querySelector("#cash-summary-table tbody");
  tbody.innerHTML = "";

  // Group cash data by date and shop, taking the first entry only
  const groupedCashData = logs.reduce((acc, log) => {
    if (shopFilter && log.shop !== shopFilter) return acc;

    const key = `${log.date}_${log.shop}`;
    if (!acc[key]) {
      acc[key] = {
        date: log.date,
        shop: log.shop,
        cashTotal: log.cashTotal,
        cashFloat: log.cashFloat,
      };
    }

    return acc;
  }, {});

  Object.values(groupedCashData).forEach(entry => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Date">${entry.date}</td>
      <td data-label="Shop">${entry.shop}</td>
      <td data-label="Cash Total (£)">£${entry.cashTotal.toFixed(2)}</td>
      <td data-label="Cash Float (£)">£${entry.cashFloat.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function populateOtherBarberSelect(currentShop) {
  const otherBarberSelect = document.getElementById('other-barber-select');
  const otherBarbersList = document.getElementById('other-barbers-list');
  
  const otherBarbers = Object.entries(barbersByShopMap)
    .filter(([shop, _]) => shop !== currentShop)
    .flatMap(([shopName, barbers]) => 
      barbers.map(barber => ({...barber, shopName}))
    );

  otherBarberSelect.innerHTML = '<option value="">Select a barber...</option>' +
    otherBarbers.map(b => 
      `<option value="${b.id}" data-shop="${b.shopName}">${b.name} (${b.shopName})</option>`
    ).join('');

  otherBarberSelect.addEventListener('change', () => {
    const selectedId = otherBarberSelect.value;
    if (!selectedId) return;
    
    const selectedOption = otherBarberSelect.selectedOptions[0];
    const barberName = selectedOption.textContent.split(' (')[0];
    const shopName = selectedOption.dataset.shop;
    
    if (document.getElementById(`other-barber-${selectedId}`)) return;
    
    const otherBarberDiv = document.createElement('div');
    otherBarberDiv.className = 'other-barber-item';
    otherBarberDiv.id = `other-barber-${selectedId}`;
    otherBarberDiv.innerHTML = `
      <div class="barber-name">${barberName} (${shopName})</div>
      <input 
        type="number" 
        min="0" 
        step="0.5" 
        placeholder="0"
        data-barber-id="${selectedId}"
        data-barber-name="${barberName}"
        style="flex: 1;"
      >
      <button type="button" class="remove-btn" onclick="this.parentElement.remove()">✖</button>
    `;
    
    otherBarbersList.appendChild(otherBarberDiv);
    otherBarberSelect.value = '';
  });
}

function renderAdminDashboard() {
  const adminView = document.getElementById("admin-view");
  adminView.innerHTML = `
    <div class="admin-header">
      <h2>Admin Dashboard</h2>
      <button id="logout-btn-admin" class="btn-secondary">Logout</button>
       <button id="send-test-email-btn" class="btn-secondary" style="margin-left:2rem;">Send Test Email</button>
    </div>
    <div style="">
     <div class="summary-metrics" style="display: flex; gap: 2rem; margin-bottom: 2rem;">
        <div>Total Haircuts: <span id="total-haircuts">0</span></div>
        <div>Total Commission (£): <span id="total-commission">0</span></div>
        <div>Total Cash (£): <span id="total-cash">0</span></div>
      </div>
      <div class="filters" style="display:flex; gap:1rem; margin-bottom:2rem;">
        <div class="filter-group">
          <label>Filter by Shop:
            <select id="admin-shop-filter">
              <option value="">All</option>
              <option value="islington">Islington</option>
              <option value="marylebone">Marylebone</option>
              <option value="shoreditch">Shoreditch</option>
              <option value="richmond">Richmond</option>
            </select>
          </label>
        </div>
          <label>Date Range:
            <input type="text" id="admin-date-range" placeholder="Select date(s)" autocomplete="off">
        </label>
        <div class="filter-group">
          <label>Filter by Barber:
            <input type="text" id="admin-barber-filter" placeholder="Barber name">
          </label>
        </div>
      </div>
      <h3>Weekly Summary</h3>
      <div class="table-responsive">
        <table id="weekly-summary-table">
          <thead>
            <tr>
            <th>Week Start</th>
            <th>Barber</th>
            <th>Haircuts</th>
            <th>Commission</th>
            <th>Pay</th>
            <th>Total</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
      
      <h3>Daily Logs</h3>
      <div class="table-responsive">
        <table id="admin-log-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shop</th>
              <th>Barber</th>
              <th>Haircuts</th>
              <th>Commission (£)</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>

      <h3>Cash Summary</h3>
      <div class="table-responsive">
        <table id="cash-summary-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Shop</th>
              <th>Cash Total (£)</th>
              <th>Cash Float (£)</th>
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    </div>
  `;
  
  updateSummaryMetrics(demoLogs);
  updateAdminTable();
  updateWeeklySummary();
  updateCashSummary();

  document.getElementById("admin-shop-filter").addEventListener("change", () => {
     const filteredLogs = filterLogsByShopAndBarber();
  updateAdminTable(filteredLogs);
  updateWeeklySummary(filteredLogs);
  updateCashSummary(filteredLogs);
  });
  
  document.getElementById("admin-barber-filter").addEventListener("input", () => {
      const filteredLogs = filterLogsByShopAndBarber();
  updateAdminTable(filteredLogs);
  updateWeeklySummary(filteredLogs);
  updateCashSummary(filteredLogs);
  });
  dateRangeInput.addEventListener("changeDate", () => {
  const filteredLogs = filterLogsByShopAndBarber();
  updateAdminTable(filteredLogs);
  updateWeeklySummary(filteredLogs);
  updateCashSummary(filteredLogs);
});

  document.getElementById("logout-btn-admin").addEventListener("click", () => {
    adminView.style.display = "none";
    loginView.style.display = "block";
    passwordInput.value = "";
  });


document.getElementById("send-test-email-btn").addEventListener("click", async () => {
  console.log('🔘 Button clicked!'); // Add this line
  
  try {
    console.log('📡 Making fetch request...'); // Add this line
    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}) // Empty body for now since you're using hardcoded values
    });
    console.log('📨 Response received:', response); // Add this line
    
    const result = await response.json();
    console.log('📋 Result:', result); // Add this line
    
    if (response.ok) {
      alert("Test email sent! Check your inbox.");
    } else {
      alert("Failed to send email: " + (result.error || JSON.stringify(result)));
    }
  } catch (err) {
    console.error('💥 Frontend error:', err); // Add this line
    alert("Error sending email: " + err.message);
  }
});

  const dateRangeInput = document.getElementById("admin-date-range");
  const datepicker = new Datepicker(dateRangeInput, {
  format: "yyyy-mm-dd",
  autohide: true,
  clearBtn: true,
  todayBtn: true,
  todayHighlight: true,
  maxNumberOfDates: 2 // allows single or range selection
});

dateRangeInput.addEventListener("changeDate", refreshAdminTables);
}

function updateSummaryMetrics(logs) {
  const totalHaircuts = logs.reduce((sum, log) => sum + log.haircuts, 0);
  const totalCommission = logs.reduce((sum, log) => sum + calculateCommission(log.haircuts), 0);

    const uniqueCashEntries = {};
  logs.forEach(log => {
    const key = `${log.shop}_${log.date}`;
    if (!uniqueCashEntries[key] && log.cashTotal !== undefined) {
      uniqueCashEntries[key] = log.cashTotal;
    }
  });
  const totalCash = Object.values(uniqueCashEntries).reduce((sum, val) => sum + val, 0);

  document.getElementById("total-haircuts").textContent = totalHaircuts;
  document.getElementById("total-commission").textContent = `£${totalCommission.toFixed(2)}`;
  document.getElementById("total-cash").textContent = `£${totalCash.toFixed(2)}`;
}

function filterLogsByShopAndBarber() {
  const shopFilter = document.getElementById("admin-shop-filter").value;
  const barberFilter = document.getElementById("admin-barber-filter").value.toLowerCase();
  const dateRangePicker = document.getElementById("admin-date-range");
  let dates = [];
  if (dateRangePicker && dateRangePicker.value) {
    dates = dateRangePicker.value.split(",");
  }
  const startDate = dates[0]?.trim();
  const endDate = dates[1]?.trim() || startDate;

  return demoLogs.filter(log => {
    const matchesShop = !shopFilter || log.shop === shopFilter;
    const matchesBarber = !barberFilter || log.barberName.toLowerCase().includes(barberFilter);
    const matchesDate = !startDate || (
      log.date >= startDate && log.date <= endDate
    );
    return matchesShop && matchesBarber && matchesDate;
  });
}

function refreshAdminTables() {
  const filteredLogs = filterLogsByShopAndBarber();
  updateSummaryMetrics(filteredLogs);
  updateAdminTable(filteredLogs);
  updateWeeklySummary(filteredLogs);
  updateCashSummary(filteredLogs);
}

dateRangeInput.addEventListener("changeDate", refreshAdminTables);
document.getElementById("admin-shop-filter").addEventListener("change", refreshAdminTables);
document.getElementById("admin-barber-filter").addEventListener("input", refreshAdminTables);

function updateAdminTable(logs = demoLogs) {
  const shopFilter = document.getElementById("admin-shop-filter").value;
  const barberFilter = document.getElementById("admin-barber-filter").value.toLowerCase();
  const tbody = document.querySelector("#admin-log-table tbody");
  tbody.innerHTML = "";

  logs
    .filter(log => (!shopFilter || log.shop === shopFilter))
    .filter(log => (!barberFilter || log.barberName.toLowerCase().includes(barberFilter)))
    .forEach(log => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-label="Date">${log.date}</td>
        <td data-label="Shop">${log.shop}</td>
        <td data-label="Barber">${log.barberName}</td>
        <td data-label="Haircuts">${log.haircuts}</td>
        <td data-label="Commission (£)">£${calculateCommission(log.haircuts)}</td>
        <td data-label="Notes">${log.notes}</td>
      `;
      tbody.appendChild(tr);
    });
}


function updateWeeklySummary(logs = demoLogs) {
  const tbody = document.querySelector("#weekly-summary-table tbody");
  tbody.innerHTML = "";

  const summary = calculateWeeklySummary(logs);

  summary.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="Week Start">${row.weekStart}</td>
      <td data-label="Barber">
        <button class="barber-profile-btn" data-barber="${row.barberName}">${row.barberName}</button>
      </td>
      <td data-label="Total Haircuts">${row.totalHaircuts}</td>
      <td data-label="Total Commission (£)">£${row.totalCommission.toFixed(2)}</td>
      <td data-label="Total Pay (£)">£${(row.totalPay - row.totalCommission).toFixed(2)}</td>
      <td data-label="Total (Pay + Commission) (£)">£${row.totalPay.toFixed(2)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Add click event for profile buttons
  tbody.querySelectorAll('.barber-profile-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showBarberProfile(btn.dataset.barber);
    });
  });
}

// Logout buttons
document.getElementById("logout-btn-form")?.addEventListener("click", () => {
  formView.style.display = "none";
  loginView.style.display = "block";
  passwordInput.value = "";
});

function showBarberProfile(barberName) {
  // Filter logs for this barber
  const logs = demoLogs.filter(log => log.barberName === barberName);

  // Create modal HTML (customize as needed)
  const modal = document.createElement('div');
  modal.className = 'barber-profile-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Profile: ${barberName}</h3>
      <button class="close-btn" style="float:right;">✖</button>
      <p><strong>Total Haircuts:</strong> ${logs.reduce((sum, log) => sum + log.haircuts, 0)}</p>
      <p><strong>Total Commission:</strong> £${logs.reduce((sum, log) => sum + calculateCommission(log.haircuts), 0).toFixed(2)}</p>
      <p><strong>Days Worked:</strong> ${[...new Set(logs.map(log => log.date))].join(', ')}</p>
      <h4>All Logs</h4>
      <table>
        <thead>
          <tr><th>Date</th><th>Shop</th><th>Haircuts</th><th>Commission</th><th>Notes</th></tr>
        </thead>
        <tbody>
          ${logs.map(log => `
            <tr>
              <td>${log.date}</td>
              <td>${log.shop}</td>
              <td>${log.haircuts}</td>
              <td>£${calculateCommission(log.haircuts)}</td>
              <td>${log.notes}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector('.close-btn').onclick = () => modal.remove();
}

