// const SUPABASE_URL = "https://ydhtxdkrzoffjdizqtej.supabase.co";
// const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkaHR4ZGtyem9mZmpkaXpxdGVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNjYwNjEsImV4cCI6MjA3MDc0MjA2MX0.SSGceGhQ2ZxrfNzxoXC0jJHd6JjKM_RwMEe4iMoTQbI";

const SUPABASE_URL = typeof process !== "undefined" && process.env.VITE_SUPABASE_URL ? process.env.VITE_SUPABASE_URL : "https://ydhtxdkrzoffjdizqtej.supabase.co";
const SUPABASE_KEY = typeof process !== "undefined" && process.env.VITE_SUPABASE_KEY ? process.env.VITE_SUPABASE_KEY : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlkaHR4ZGtyem9mZmpkaXpxdGVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUxNjYwNjEsImV4cCI6MjA3MDc0MjA2MX0.SSGceGhQ2ZxrfNzxoXC0jJHd6JjKM_RwMEe4iMoTQbI";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);


const barbersByShop = {
islington: ["Bradley", "Juan", "Stef", "Maz", "Lou", "Tom"],
  marylebone: ["Kaan", "Geoffrey", "Ruarai","Bobby","Mo"],
  shoreditch: ["August", "Nico", "Eddie","Antonio","Barney"],
  richmond: ["James", "Sophia"]
};

// Demo passwords
const passwords = {
  barber: "barbersmiths123",
  admin: "Hareth08"
};

const loginBtn = document.getElementById("login-btn");
const shopSelect = document.getElementById("shop-select");
const passwordInput = document.getElementById("password");
const loginView = document.getElementById("login-view");
const formView = document.getElementById("form-view");
const adminView = document.getElementById("admin-view");
const barberListDiv = document.getElementById("barber-list");
const dailyForm = document.getElementById("daily-form");

let demoLogs = [];

const shopsMap = {};
const barbersByShopMap = {}; 

async function loadShopsAndBarbers() {
  // fetch shops
  const { data: shops, error: shopsErr } = await supabaseClient
    .from('shops')
    .select('id,name');
  if (shopsErr) {
    console.error('Error loading shops', shopsErr);
    return;
  }
  shops.forEach(s => shopsMap[s.name] = s.id);

  // fetch barbers
  const { data: barbers, error: barbersErr } = await supabaseClient
    .from('barbers')
    .select('id,name,shop_id');
  if (barbersErr) {
    console.error('Error loading barbers', barbersErr);
    return;
  }
  // group by shop name (resolve shop_id -> shop name)
  barbers.forEach(b => {
    // find shop name for this barber's shop_id
    const shopEntry = Object.entries(shopsMap).find(([, id]) => id === b.shop_id);
    const shopName = shopEntry ? shopEntry[0] : 'unknown';
    barbersByShopMap[shopName] = barbersByShopMap[shopName] || [];
    barbersByShopMap[shopName].push({ id: b.id, name: b.name });
  });
}

// call on load
loadShopsAndBarbers().then(() => {
  // optional: pre-populate select options if you want dynamic shop list
});


// Replace demo submit with DB insert
dailyForm.removeEventListener?.('submit', ()=>{}); // safe no-op if not supported
dailyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const feedback = document.getElementById("form-feedback");
  feedback.textContent = "";

  const shopName = shopSelect.value;
  const shopId = shopsMap[shopName];
  const date = document.getElementById("date").value;
  const cashTotal = document.getElementById("cash-total").value;
  const cashFloat = document.getElementById("cash-float").value;

  if (!date || !cashTotal || !cashFloat) {
    feedback.textContent = "Please fill in all required fields.";
    return;
  }

  const barberInputs = barberListDiv.querySelectorAll("input[type='number']");
  const rowsToInsert = [];
  barberInputs.forEach(input => {
    const val = input.value;
    const haircuts = val === "" ? 0 : Number(val);
    if (haircuts > 0) {
      const barberId = input.dataset.barberId || null;
      // if barberId missing, try resolve by name
      const barberName = input.dataset.barberName;
      let finalBarberId = barberId;
      if (!finalBarberId) {
        const arr = (barbersByShopMap[shopName] || []).filter(b => b.name === barberName);
        if (arr.length) finalBarberId = arr[0].id;
      }
      rowsToInsert.push({
        shop_id: shopId,
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

  // batch insert
  const { data, error } = await supabaseClient.from('daily_logs').insert(rowsToInsert);
  if (error) {
    console.error('Insert error', error);
    feedback.textContent = "Error saving data. Check console.";
    return;
  }

  feedback.style.color = "green";
  feedback.textContent = "Form submitted!";
  dailyForm.reset();
  document.getElementById("date").value = new Date().toISOString().slice(0,10);
  setTimeout(() => { feedback.textContent = ""; feedback.style.color = ""; }, 2000);
});


function calculateCommission(haircuts) {
  if (haircuts >= 15) return 40;
  if (haircuts >= 13) return 20;
  if (haircuts >= 10) return 10;
  return 0;
}

function getMonday(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  return new Date(date.setDate(diff)).toISOString().slice(0,10);
}

function calculateWeeklySummary(logs) {
  // Group by barber and week
  const summary = {};
  logs.forEach(log => {
    const weekStart = getMonday(log.date);
    const key = `${log.shop}_${log.barberName}_${weekStart}`;
    if (!summary[key]) {
      summary[key] = {
        shop: log.shop,
        barberName: log.barberName,
        weekStart,
        totalHaircuts: 0,
        totalCommission: 0
      };
    }
    summary[key].totalHaircuts += log.haircuts;
    summary[key].totalCommission += calculateCommission(log.haircuts);
  });
  return Object.values(summary);
}



async function fetchAndRenderLogs() {
  // join with barbers and shops (requires relationships in DB)
  const { data, error } = await supabaseClient
    .from('daily_logs')
    .select('id,date,cash_total,cash_float,notes,haircuts,barbers(id,name),shops(id,name)')
    .order('date', { ascending: false });
  if (error) {
    console.error('Error fetching logs', error);
    return;
  }

  // normalize into same shape your renderer expects
  demoLogs = (data || []).map(r => ({
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

}

// call fetchAndRenderLogs when admin opens dashboard
// replace renderAdminDashboard() call where you set adminView visible:
async function openAdminView() {
  loginView.style.display = "none";
  adminView.style.display = "block";
  await fetchAndRenderLogs();
  renderAdminDashboard(); // this will wire filters + render current demoLogs
}

// Admin dashboard logic
function renderAdminDashboard() {
  const adminView = document.getElementById("admin-view");
  adminView.innerHTML = `
    <p>Admin Dashboard<p>
    <label>Filter by Shop:
      <select id="admin-shop-filter">
        <option value="">All</option>
        <option value="islington">Islington</option>
        <option value="marylebone">Marylebone</option>
        <option value="shoreditch">Shoreditch</option>
        <option value="richmond">Richmond</option>
      </select>
    </label>
    <label>Filter by Barber:
      <input type="text" id="admin-barber-filter" placeholder="Barber name">
    </label>
     <p style="margin-top:32px;">Weekly Commission Summary (Monday Start)</p>
    <table id="weekly-summary-table" style="width:100%;margin-top:8px;">
      <thead>
        <tr>
          <th>Week Start</th>
          <th>Shop</th>
          <th>Barber</th>
          <th>Total Haircuts</th>
          <th>Total Commission (£)</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
    <table id="admin-log-table" style="width:100%;margin-top:16px;">
      <thead>
        <tr>
          <th>Date</th>
          <th>Shop</th>
          <th>Barber</th>
          <th>Haircuts</th>
          <th>Commission (£)</th>
          <th>Cash Total</th>
          <th>Cash Float</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
   
  `;
  updateAdminTable();
  updateWeeklySummary();

  document.getElementById("admin-shop-filter").addEventListener("change", () => {
    updateAdminTable();
    updateWeeklySummary();
  });
  document.getElementById("admin-barber-filter").addEventListener("input", () => {
    updateAdminTable();
    updateWeeklySummary();
  });
}

function updateAdminTable() {
  const shopFilter = document.getElementById("admin-shop-filter").value;
  const barberFilter = document.getElementById("admin-barber-filter").value.toLowerCase();
  const tbody = document.querySelector("#admin-log-table tbody");
  tbody.innerHTML = "";

  demoLogs
    .filter(log => (!shopFilter || log.shop === shopFilter))
    .filter(log => (!barberFilter || log.barberName.toLowerCase().includes(barberFilter)))
    .forEach(log => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${log.date}</td>
        <td>${log.shop}</td>
        <td>${log.barberName}</td>
        <td>${log.haircuts}</td>
        <td>£${calculateCommission(log.haircuts)}</td>
        <td>${log.cashTotal}</td>
        <td>${log.cashFloat}</td>
        <td>${log.notes}</td>
      `;
      tbody.appendChild(tr);
    });
}

function updateWeeklySummary() {
  const shopFilter = document.getElementById("admin-shop-filter").value;
  const barberFilter = document.getElementById("admin-barber-filter").value.toLowerCase();
  const tbody = document.querySelector("#weekly-summary-table tbody");
  tbody.innerHTML = "";

  const filteredLogs = demoLogs
    .filter(log => (!shopFilter || log.shop === shopFilter))
    .filter(log => (!barberFilter || log.barberName.toLowerCase().includes(barberFilter)));

  const summary = calculateWeeklySummary(filteredLogs);

  summary.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.weekStart}</td>
      <td>${row.shop}</td>
      <td>${row.barberName}</td>
      <td>${row.totalHaircuts}</td>
      <td>£${row.totalCommission}</td>
    `;
    tbody.appendChild(tr);
  });
}


loginBtn.addEventListener("click", () => {
  const shop = shopSelect.value;
  const password = passwordInput.value;
  const loginFeedback = document.getElementById("login-feedback");
  loginFeedback.textContent = "";

  if (!password) {
    loginFeedback.textContent = "Please enter your password.";
    return;
  }

  if (password === passwords.admin) {
    // use openAdminView so logs are fetched before rendering the dashboard
    openAdminView();
  } else if (password === passwords.barber) {
    loginView.style.display = "none";
    formView.style.display = "block";
    populateBarberInputs(shop);
    document.getElementById("date").value = new Date().toISOString().slice(0,10);
  } else {
    loginFeedback.textContent = "Incorrect password. Please try again.";
  }
});

// function populateBarberInputs(shopName) {
//   barberListDiv.innerHTML = "";
//   const list = barbersByShopMap[shopName] || (barbersByShop[shopName] || []).map(n => ({ id: null, name: n }));
  
//   list.forEach(barber => {
//     const label = document.createElement("label");
//     label.textContent = `${barber.name} Haircuts: `;
//     const input = document.createElement("input");
//     input.type = "number";
//     input.min = "0";
//     input.step = "0.5";
//     if (barber.id) input.dataset.barberId = barber.id;
//     input.dataset.barberName = barber.name;
//     input.name = `haircuts_${barber.name}`;
//     input.placeholder = "0";
//     label.appendChild(input);
//     barberListDiv.appendChild(label);
//   });
//     // Add "Other Barbers" dropdown
//   const otherBarbers = Object.entries(barbersByShopMap)
//     .filter(([shop, _]) => shop !== shopName)
//     .flatMap(([_, barbers]) => barbers);

//   if (otherBarbers.length > 0) {
//     const selectLabel = document.createElement("label");
//     selectLabel.textContent = "Other Barber:";
//     const select = document.createElement("select");
//     select.innerHTML = `<option value="">Select...</option>` +
//     otherBarbers.map(b => `<option value="${b.id}">${b.name}</option>`).join("")
//     select.id = "other-barber-select";
//     selectLabel.appendChild(select);
//     barberListDiv.appendChild(selectLabel);

//     // When selected, add input for that barber
//    select.addEventListener("change", () => {
//   const selectedId = select.value;
//   if (!selectedId) return;
//   const selectedBarber = otherBarbers.find(b => b.id === selectedId);
//   if (!selectedBarber) return;
//   // Prevent duplicate input
//   if (document.getElementById(`other-barber-input-${selectedId}`)) return;

//  const label = document.createElement("label");
// label.textContent = `${selectedBarber.name} (Other) Haircuts: `;
// label.style.display = "flex";
// label.style.alignItems = "center";
// label.style.gap = "8px"; // optional: adds space between input and button


//   const input = document.createElement("input");
//   input.type = "number";
//   input.min = "0";
//   input.step = "0.5";
//   input.dataset.barberId = selectedBarber.id;
//   input.dataset.barberName = selectedBarber.name;
//   input.name = `haircuts_${selectedBarber.name}`;
//   input.placeholder = "0";
//   input.id = `other-barber-input-${selectedId}`;

//   // Add remove button
//   const removeBtn = document.createElement("button");
//   removeBtn.type = "button";
//   removeBtn.textContent = "✖";
//   removeBtn.style.marginLeft = "8px";
//   removeBtn.style.cursor = "pointer";
//   removeBtn.style.width = "10%"; // optional: make button smaller
//   removeBtn.title = "Remove barber";
//   removeBtn.onclick = () => label.remove();

//   label.appendChild(input);
//   label.appendChild(removeBtn);
//   barberListDiv.appendChild(label);

//   select.value = ""; // reset dropdown so user can add more
// });
//   }
// }


// Add these improvements to your existing app.js

function populateBarberInputs(shopName) {
  barberListDiv.innerHTML = "";
  const list = barbersByShopMap[shopName] || (barbersByShop[shopName] || []).map(n => ({ id: null, name: n }));
  
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

// Update feedback display
function showFeedback(message, type = 'success') {
  const feedback = document.getElementById('form-feedback') || document.getElementById('login-feedback');
  feedback.textContent = message;
  feedback.className = `feedback ${type}`;
  feedback.style.display = 'block';
  
  if (type === 'success') {
    setTimeout(() => {
      feedback.style.display = 'none';
    }, 3000);
  }
}
