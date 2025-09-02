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
      loadShopReviewProgress();
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
    
  const shopName = shopSelect.value;
  const date = document.getElementById("date").value;
  const cashTotal = document.getElementById("cash-total").value;
  const cashFloat = document.getElementById("cash-float").value;

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
        
        try {
        console.log('Sending notification email...'); // Add logging
        const emailPayload = {
          from: 'Barbersmiths <admin@submissions.barbersmiths.co.uk>',
          to: ['contact@barbersmiths.co.uk'], 
          subject: `Daily Report Submitted: ${shopName} (${date})`,
          html: `
            <h2>Daily Report Submitted</h2>
            <p><strong>Shop:</strong> ${shopName}</p>
            <p><strong>Date:</strong> ${date}</p>
            <p><strong>Cash Total:</strong> £${cashTotal}</p>
            <p><strong>Cash Float:</strong> £${cashFloat}</p>
            <p><strong>Notes:</strong> ${document.getElementById("notes").value || "-"}</p>
            <hr>
            <strong>Barber Haircuts:</strong>
            <ul>
              ${rowsToInsert.map(r => `<li>${getBarberNameById(r.barber_id) || r.barberName}: <strong>${r.haircuts}</strong></li>`).join("")}
            </ul>
          `
        };
        
        console.log('Email payload:', emailPayload); // Add logging
        
        const emailResponse = await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(emailPayload)
        });
        
        const emailResult = await emailResponse.text();
        console.log('Email response:', emailResponse.status, emailResult); // Add logging
        
        if (emailResponse.ok) {
          console.log("Notification email sent successfully!");
        } else {
          console.error("Email failed:", emailResult);
        }
      } catch (err) {
        console.error("Failed to send notification email:", err);
      }
         try {
          const barberList = rowsToInsert.map(r => `${getBarberNameById(r.barber_id) || r.barberName}:${r.haircuts}`).join(', ');
        const whatsappPayload = {
            templateName: 'hello_world',
            templateLanguage: 'en_US'
            // no templateParams for testing
          };
          const waResp = await fetch('/api/send-whatsapp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(whatsappPayload)
          });

          const waText = await waResp.text();
          let waJson = null;
          try { waJson = JSON.parse(waText); } catch (e) { /* not JSON */ }

          if (waResp.ok) {
            console.log('WhatsApp sent:', waResp.status, waJson ?? waText);
          } else {
            console.error('WhatsApp failed:', waResp.status, waJson ?? waText);
          }
        } catch (waErr) {
          console.error('WhatsApp send failed', waErr);
        }

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
        id: log.id,
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
    tr.dataset.id = entry.id;
    tr.innerHTML = `
      <td data-label="Date">${entry.date}</td>
      <td data-label="Shop">${entry.shop}</td>
      <td data-label="Cash Total (£)" class="cell-cash-total">£${entry.cashTotal.toFixed(2)}</td>
      <td data-label="Cash Float (£)" class="cell-cash-float">£${entry.cashFloat.toFixed(2)}</td>
      <td data-label="Actions" class="cell-actions">
        <button class="edit-btn">Edit</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
    tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      enableCashRowEditing(tr);
    });
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
    </div>
    <div style="">
      <div id="summary-metrics" style="">
        <div id="total-haircuts"></div>
        <div id="total-commission"></div>
        <div id="total-cash"></div>
        <div id="total-pay"></div>
      </div>
       <section id="reviews-section" class="reviews-section">
          <div class="reviews-header">
            <h3>Review Progress</h3>
            <p class="reviews-sub"></p>
          </div>
          <div id="review-cards" class="review-cards"></div>
        </section>
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
//   dateRangeInput.addEventListener("changeDate", () => {
//   const filteredLogs = filterLogsByShopAndBarber();
//   updateAdminTable(filteredLogs);
//   updateWeeklySummary(filteredLogs);
//   updateCashSummary(filteredLogs);
// });
document.getElementById("admin-date-range").addEventListener("changeDate", () => {
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

 const sendBtn = document.getElementById("send-test-email-btn");
  if (sendBtn) {
    sendBtn.addEventListener("click", async () => {
      console.log('🔘 Send Test Email button clicked');
      const to = prompt('Enter test recipient email', 'you@yourdomain.com');
      if (!to) { console.log('No recipient entered — aborting'); return; }
      const payload = {
        from: 'Test <admin@submissions.barbersmiths.co.uk>',
        to: [to],
        subject: 'Resend test — BarberSmiths',
        html: '<strong>Resend test — it works!</strong>'
      };
      console.log('Sending payload:', payload);
      try {
        const resp = await fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const text = await resp.text();
        console.log('Network response status:', resp.status, 'body:', text);
        alert('Request complete — check browser console and server logs');
      } catch (err) {
        console.error('Fetch error:', err);
        alert('Fetch error — see console');
      }
    });
  }


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

function updateSummaryMetrics(logs = demoLogs) {
  // Get current month/year for the tag
  const now = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const currentMonth = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  // Calculate totals
  let totalHaircuts = 0;
  let totalCommission = 0;
  let totalCash = 0;
  
  const countedDayRates = new Set();
  let totalDayRates = 0;

   const cashGroups = {};

 logs.forEach(log => {
    totalHaircuts += Number(log.haircuts) || 0;

    const commission = calculateCommission(Number(log.haircuts) || 0);
    totalCommission += commission;

    totalCash += (Number(log.cashTotal) || 0) + (Number(log.cashFloat) || 0);

    // Count the barber's day rate once per barber/date
   const barberKey = (log.barber_id != null ? String(log.barber_id) : (log.barberName || 'unknown'));
    const workedKey = `${barberKey}_${log.date}`;
    if (!countedDayRates.has(workedKey)) {
      // lookup dayRate from barbersByShopMap
      let dayRate = 0;
      for (const shop in barbersByShopMap) {
        const found = barbersByShopMap[shop].find(b => (b.id != null && String(b.id) === String(log.barber_id)) || b.name === log.barberName);
        if (found) {
          dayRate = Number(found.dayRate) || 0;
          break;
        }
      }
      totalDayRates += dayRate;
      countedDayRates.add(workedKey);
    }

    // collect cash_total per date+shop (first occurrence wins)
    const cashKey = `${log.date}_${log.shop}`;
    if (!cashGroups[cashKey]) {
      cashGroups[cashKey] = {
        cashTotal: Number(log.cashTotal) || 0
        // intentionally exclude cashFloat here
      };
    }
  });

  totalCash = Object.values(cashGroups).reduce((sum, g) => sum + (g.cashTotal || 0), 0);

  // Total pay = wages (day rates) + commissions
  const totalPay = totalDayRates + totalCommission;

  // Update HTML elements (assuming these IDs exist in your HTML)
  document.getElementById('total-haircuts').innerHTML = `
    <div class="summary-card">
      <div class="summary-card-inner">
        <div class="summary-label">Total Haircuts</div>
        <div class="summary-value">${totalHaircuts}</div>
        <div class="summary-month">${currentMonth}</div>
      </div>
    </div>
  `;

  document.getElementById('total-commission').innerHTML = `
    <div class="summary-card">
      <div class="summary-card-inner">
        <div class="summary-label">Total Commission</div>
        <div class="summary-value">£${totalCommission.toFixed(2)}</div>
        <div class="summary-month">${currentMonth}</div>
      </div>
    </div>
  `;

  document.getElementById('total-cash').innerHTML = `
    <div class="summary-card">
      <div class="summary-card-inner">
        <div class="summary-label">Total Cash</div>
        <div class="summary-value">£${totalCash.toFixed(2)}</div>
        <div class="summary-month">${currentMonth}</div>
      </div>
    </div>
  `;

  // New: Total Pay summary
  document.getElementById('total-pay').innerHTML = `
    <div class="summary-card">
      <div class="summary-card-inner">
        <div class="summary-label">Total Pay</div>
        <div class="summary-value">£${totalPay.toFixed(2)}</div>
        <div class="summary-month">${currentMonth}</div>
      </div>
    </div>
  `;
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
      tr.dataset.id = log.id;
      tr.innerHTML = `
        <td data-label="Date">${log.date}</td>
        <td data-label="Shop">${log.shop}</td>
        <td data-label="Barber">${log.barberName}</td>
        <td data-label="Haircuts" class="cell-haircuts">${log.haircuts}</td>
        <td data-label="Commission (£)" class="cell-commission">£${calculateCommission(log.haircuts)}</td>
        <td data-label="Notes"  class="cell-notes">${log.notes}</td>
         <td data-label="Actions" class="cell-actions">
          <button class="edit-btn">Edit</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
     tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      enableAdminRowEditing(tr);
    });
  });
}


function updateWeeklySummary(logs = demoLogs) {
  const tbody = document.querySelector("#weekly-summary-table tbody");
  tbody.innerHTML = "";

  // If today is Monday, keep showing the previous week.
  // On Tuesday+ show the current week as before.
  const today = new Date();
  const todayDay = today.getDay(); // 0=Sun,1=Mon...
  const refDate = (todayDay === 1) ? new Date(today.getTime() - 24 * 60 * 60 * 1000) : today;
  const todayIso = refDate.toISOString().slice(0,10);

  const weekStart = getMonday(todayIso); // Monday for refDate
  const weekEndDate = new Date(weekStart);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEnd = weekEndDate.toISOString().slice(0,10);

  // filter logs to the chosen week
  const currentWeekLogs = (logs || demoLogs).filter(log => {
    return log.date >= weekStart && log.date <= weekEnd;
  });

  const summary = calculateWeeklySummary(currentWeekLogs);

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

function enableAdminRowEditing(tr) {
  if (!tr) return;
  const id = tr.dataset.id;
  
  // store original values for cancel
  tr.dataset.origHaircuts = tr.querySelector('.cell-haircuts').textContent;
  tr.dataset.origNotes = tr.querySelector('.cell-notes').textContent;

  const haircutsCell = tr.querySelector('.cell-haircuts');
  const notesCell = tr.querySelector('.cell-notes');
  const commissionCell = tr.querySelector('.cell-commission');
  const actionsCell = tr.querySelector('.cell-actions');

  const haircutsVal = parseFloat(tr.dataset.origHaircuts) || 0;
  const notesVal = tr.dataset.origNotes || '';

  haircutsCell.innerHTML = `<input type="number" class="edit-haircuts" min="0" step="0.5" value="${haircutsVal}">`;
  notesCell.innerHTML = `<input type="text" class="edit-notes" value="${notesVal}">`;

  actionsCell.innerHTML = `
    <button class="save-btn">Save</button>
    <button class="cancel-btn">Cancel</button>
  `;

  // update commission on haircuts change
  haircutsCell.querySelector('.edit-haircuts').addEventListener('input', (e) => {
    const v = Number(e.target.value) || 0;
    commissionCell.textContent = `£${calculateCommission(v).toFixed(2)}`;
  });

  actionsCell.querySelector('.save-btn').addEventListener('click', async () => {
    await saveAdminRowEdits(tr);
  });
  actionsCell.querySelector('.cancel-btn').addEventListener('click', () => {
    cancelAdminRowEdits(tr);
  });
}

// Edit cash table rows (cash total + float)
function enableCashRowEditing(tr) {
  if (!tr) return;
  const id = tr.dataset.id;
  
  // store original values for cancel
  tr.dataset.origCashTotal = tr.querySelector('.cell-cash-total').textContent.replace(/£/g,'');
  tr.dataset.origCashFloat = tr.querySelector('.cell-cash-float').textContent.replace(/£/g,'');

  const cashTotalCell = tr.querySelector('.cell-cash-total');
  const cashFloatCell = tr.querySelector('.cell-cash-float');
  const actionsCell = tr.querySelector('.cell-actions');

  const cashTotalVal = parseFloat(tr.dataset.origCashTotal) || 0;
  const cashFloatVal = parseFloat(tr.dataset.origCashFloat) || 0;

  cashTotalCell.innerHTML = `<input type="number" class="edit-cash-total" min="0" step="0.01" value="${cashTotalVal}">`;
  cashFloatCell.innerHTML = `<input type="number" class="edit-cash-float" min="0" step="0.01" value="${cashFloatVal}">`;

  actionsCell.innerHTML = `
    <button class="save-btn">Save</button>
    <button class="cancel-btn">Cancel</button>
  `;

  actionsCell.querySelector('.save-btn').addEventListener('click', async () => {
    await saveCashRowEdits(tr);
  });
  actionsCell.querySelector('.cancel-btn').addEventListener('click', () => {
    cancelCashRowEdits(tr);
  });
}

// Save admin row edits (haircuts + notes)
async function saveAdminRowEdits(tr) {
  const id = tr.dataset.id;
  const haircuts = Number(tr.querySelector('.edit-haircuts').value) || 0;
  const notes = tr.querySelector('.edit-notes').value || '';

  // optimistic update
  const idx = demoLogs.findIndex(l => String(l.id) === String(id));
  const orig = idx !== -1 ? { ...demoLogs[idx] } : null;
  if (idx !== -1) {
    demoLogs[idx].haircuts = haircuts;
    demoLogs[idx].notes = notes;
  }

  // update UI immediately
  tr.querySelector('.cell-haircuts').textContent = haircuts;
  tr.querySelector('.cell-commission').textContent = `£${calculateCommission(haircuts).toFixed(2)}`;
  tr.querySelector('.cell-notes').textContent = notes;
  tr.querySelector('.cell-actions').innerHTML = `<button class="edit-btn">Edit</button>`;
  tr.querySelector('.edit-btn').addEventListener('click', () => enableAdminRowEditing(tr));

  // send to server
  try {
    const resp = await fetch('/api/update-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        haircuts,
        notes,
        password: passwordInput.value
      })
    });

    const json = await resp.json();
    if (!resp.ok || !json.success) {
      console.error('Update failed', json);
      if (orig && idx !== -1) {
        demoLogs[idx] = orig;
      }
      cancelAdminRowEdits(tr, /*revertToOrig=*/true);
      alert('Update failed on server. Changes reverted.');
      return;
    }

    // apply DB-returned data
    const updated = json.data || {};
    if (idx !== -1) {
      demoLogs[idx].haircuts = Number(updated.haircuts) || demoLogs[idx].haircuts;
      demoLogs[idx].notes = updated.notes || demoLogs[idx].notes;
    }

    refreshAdminTables();
  } catch (err) {
    console.error('Network error saving update', err);
    const idx2 = demoLogs.findIndex(l => String(l.id) === String(id));
    if (idx2 !== -1 && tr.dataset.origHaircuts) {
      demoLogs[idx2].haircuts = Number(tr.dataset.origHaircuts) || demoLogs[idx2].haircuts;
      demoLogs[idx2].notes = tr.dataset.origNotes || demoLogs[idx2].notes;
    }
    cancelAdminRowEdits(tr, /*revertToOrig=*/true);
    alert('Network error. Changes reverted.');
  }
}

// Save cash row edits (cash total + float)
async function saveCashRowEdits(tr) {
  const id = tr.dataset.id;
  const cashTotal = Number(tr.querySelector('.edit-cash-total').value) || 0;
  const cashFloat = Number(tr.querySelector('.edit-cash-float').value) || 0;

  // Find the actual record to get date and shop
  const record = demoLogs.find(l => String(l.id) === String(id));
  if (!record) {
    alert('Record not found');
    return;
  }

  // Find all records for this date/shop combination
  const matchingRecords = demoLogs.filter(l => 
    l.date === record.date && l.shop === record.shop
  );

  // Update all matching records optimistically
  const originals = matchingRecords.map(r => ({ ...r }));
  matchingRecords.forEach(r => {
    r.cashTotal = cashTotal;
    r.cashFloat = cashFloat;
  });

  // Update UI immediately
  tr.querySelector('.cell-cash-total').textContent = `£${cashTotal.toFixed(2)}`;
  tr.querySelector('.cell-cash-float').textContent = `£${cashFloat.toFixed(2)}`;
  tr.querySelector('.cell-actions').innerHTML = `<button class="edit-btn">Edit</button>`;
  tr.querySelector('.edit-btn').addEventListener('click', () => enableCashRowEditing(tr));

  // Send to server - update all matching records
  try {
    const updatePromises = matchingRecords.map(record => 
      fetch('/api/update-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.id,
          cashTotal,
          cashFloat,
          password: passwordInput.value
        })
      })
    );

    const responses = await Promise.all(updatePromises);
    const results = await Promise.all(responses.map(r => r.json()));

    // Check if any failed
    const failed = results.some((result, i) => !responses[i].ok || !result.success);
    
    if (failed) {
      console.error('Some updates failed', results);
      // Revert all changes
      originals.forEach((orig, i) => {
        Object.assign(matchingRecords[i], orig);
      });
      cancelCashRowEdits(tr, true);
      alert('Update failed on server. Changes reverted.');
      return;
    }

    refreshAdminTables();
  } catch (err) {
    console.error('Network error saving update', err);
    // Revert all changes
    originals.forEach((orig, i) => {
      Object.assign(matchingRecords[i], orig);
    });
    cancelCashRowEdits(tr, true);
    alert('Network error. Changes reverted.');
  }
}

// Cancel admin row edits
function cancelAdminRowEdits(tr, revertToOrig = false) {
  const origHaircuts = tr.dataset.origHaircuts || '0';
  const origNotes = tr.dataset.origNotes || '';

  if (revertToOrig) {
    const id = tr.dataset.id;
    const idx = demoLogs.findIndex(l => String(l.id) === String(id));
    if (idx !== -1) {
      demoLogs[idx].haircuts = Number(origHaircuts) || 0;
      demoLogs[idx].notes = origNotes;
    }
  }

  tr.querySelector('.cell-haircuts').textContent = origHaircuts;
  tr.querySelector('.cell-commission').textContent = `£${calculateCommission(Number(origHaircuts)).toFixed(2)}`;
  tr.querySelector('.cell-notes').textContent = origNotes;

  tr.querySelector('.cell-actions').innerHTML = `<button class="edit-btn">Edit</button>`;
  tr.querySelector('.edit-btn').addEventListener('click', () => enableAdminRowEditing(tr));
}

// Cancel cash row edits
function cancelCashRowEdits(tr, revertToOrig = false) {
  const origCashTotal = tr.dataset.origCashTotal || '0';
  const origCashFloat = tr.dataset.origCashFloat || '0';

  if (revertToOrig) {
    const id = tr.dataset.id;
    const idx = demoLogs.findIndex(l => String(l.id) === String(id));
    if (idx !== -1) {
      demoLogs[idx].cashTotal = Number(origCashTotal) || 0;
      demoLogs[idx].cashFloat = Number(origCashFloat) || 0;
    }
  }

  tr.querySelector('.cell-cash-total').textContent = `£${Number(origCashTotal).toFixed(2)}`;
  tr.querySelector('.cell-cash-float').textContent = `£${Number(origCashFloat).toFixed(2)}`;

  tr.querySelector('.cell-actions').innerHTML = `<button class="edit-btn">Edit</button>`;
  tr.querySelector('.edit-btn').addEventListener('click', () => enableCashRowEditing(tr));
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

const placeIdsByShop = {
  islington: 'ChIJ-6z84C4bdkgRPsVt5LDn2LY',
  marylebone: 'ChIJv2Eq53cbdkgRgpCuMeacAlU',
  shoreditch: 'ChIJZUYpQSYddkgR65AC3dCWq8E',
  richmond: 'ChIJq26ylCoNdkgRSflpO4Tljk4'
};

const manualFiveStarData = {
  islington: {
    totalFiveStars: 53, // Your manual count
    totalRatings: 403,  // At time of manual count
    bonusesEarned: 2,   // 53 ÷ 25 = 2 bonuses earned
    currentProgress: 3  // 53 % 25 = 3 toward next bonus
  },
   shoreditch: {
    totalFiveStars: 69, 
    totalRatings: 308, 
    bonusesEarned: 2,   
    currentProgress: 9  
  },
  marylebone: {
    totalFiveStars: 45, 
    totalRatings: 181, 
    bonusesEarned: 1,   
    currentProgress: 15  
  },
  richmond: {
    totalFiveStars: 49, 
    totalRatings: 50, 
    bonusesEarned: 1,   
    currentProgress: 24  
  },
 
};

async function loadShopReviewProgress() {
  Object.entries(placeIdsByShop).forEach(async ([shopKey, placeId]) => {
    const elId = `reviews-${shopKey}`;
    let el = document.getElementById(elId);

    // create card container inside #review-cards
    const cardsContainer = document.getElementById('review-cards');
    if (!cardsContainer) return; // guard if render not present

    if (!el) {
      el = document.createElement('div');
      el.id = elId;
      el.className = 'review-card';
      cardsContainer.appendChild(el);
    }

    try {
      const resp = await fetch(`/api/business-reviews?placeId=${encodeURIComponent(placeId)}`);
      const json = await resp.json();

      const fiveStar = json.fiveStarSample || 0;
      const total = json.totalRatings || 0;
      const avgRating = json.avgRating || 0;
      const target = 25;

      const manualData = manualFiveStarData[shopKey];
      let bonusesEarned = 0;
      let currentProgress = fiveStar;
      let estTotalFive = fiveStar;

      if (manualData) {
        const ratingGrowth = Math.max(0, total - manualData.totalRatings);
        const estimatedNewFiveStars = Math.round(ratingGrowth * (avgRating / 5));
        estTotalFive = manualData.totalFiveStars + estimatedNewFiveStars;
        bonusesEarned = Math.floor(estTotalFive / target);
        currentProgress = estTotalFive % target;
      } else {
        // best-effort estimate if no manual baseline
        bonusesEarned = Math.floor(fiveStar / target);
        currentProgress = fiveStar % target;
        estTotalFive = fiveStar;
      }

      el.innerHTML = `
        <div class="review-card-inner">
          <div class="review-card-head">
            <div class="review-shop">${shopKey.toUpperCase()}</div>
            <div class="review-rating">★ ${avgRating.toFixed(1)}</div>
          </div>

          <div class="review-meta">
            <div class="review-total">${estTotalFive} (5★)</div>
            <div class="review-count">${total} total ratings</div>
          </div>

          <div class="review-progress-bar" aria-hidden="true">
            <div class="review-progress-fill" style="width: ${Math.min(100, (currentProgress / target) * 100)}%"></div>
          </div>

          <div class="review-progress-text">
            <strong>${currentProgress}/${target}</strong>
            <span class="small-muted"> Bonuses: ${bonusesEarned}</span>
          </div>
        </div>
      `;
    } catch (err) {
      console.error('loadShopReviewProgress error', shopKey, err);
      el.innerHTML = `<div class="review-card-inner error"><strong>${shopKey}</strong>: error loading reviews</div>`;
    }
  });
}
