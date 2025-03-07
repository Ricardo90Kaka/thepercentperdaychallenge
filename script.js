console.log("script.js is geladen");

let settings = JSON.parse(localStorage.getItem('settings')) || {};
let entries = JSON.parse(localStorage.getItem('entries')) || [];

const growthCtx = document.getElementById('growthChart')?.getContext('2d');
let growthChart;

function formatNumber(number) {
    const rounded = Math.round(number);
    return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function saveSettings() {
    const startBalance = parseFloat(document.getElementById('start-balance').value);
    const targetPercentage = parseFloat(document.getElementById('target-percentage').value);
    if (startBalance && targetPercentage) {
        settings = { startBalance, targetPercentage, startDate: new Date().toISOString() };
        localStorage.setItem('settings', JSON.stringify(settings));
        console.log("Settings opgeslagen:", settings);
        updateChart();
        updateStartBalanceDisplay();
        updateCurrentWeekOverview();
        updateWeekOverview();
    } else {
        alert("Vul zowel de beginstand als het doelpercentage in!");
    }
}

function addDailyEntry() {
    const endBalance = parseFloat(document.getElementById('end-balance').value);
    if (endBalance) {
        entries.push({ date: new Date().toISOString(), endBalance });
        localStorage.setItem('entries', JSON.stringify(entries));
        document.getElementById('end-balance').value = '';
        console.log("Entry toegevoegd:", entries);
        updateChart();
        updateCurrentWeekOverview();
        updateHistoryTable();
        updateWeekOverview();
    } else {
        alert("Vul een eindbalans in!");
    }
}

function updateChart() {
    console.log("updateChart aangeroepen"); // Debug
    if (!growthCtx) {
        console.log("Geen canvas context gevonden voor growthChart");
        return;
    }
    if (typeof Chart === 'undefined') {
        console.log("Chart.js is niet geladen");
        return;
    }
    if (!settings.startBalance) {
        console.log("Geen startBalance ingesteld, grafiek niet bijgewerkt");
        return;
    }

    const labels = entries.map(entry => new Date(entry.date).toLocaleDateString());
    const actualData = entries.map(entry => entry.endBalance);
    const targetData = [];
    let currentTarget = settings.startBalance;
    targetData.push(currentTarget);
    for (let i = 0; i < entries.length; i++) {
        currentTarget *= (1 + settings.targetPercentage / 100);
        targetData.push(currentTarget);
    }

    if (growthChart) growthChart.destroy();
    console.log("Grafiekdata:", { labels: ['Start', ...labels], actualData: [settings.startBalance, ...actualData], targetData });
    growthChart = new Chart(growthCtx, {
        type: 'line',
        data: {
            labels: ['Start', ...labels],
            datasets: [
                { label: 'Werkelijke balans', data: [settings.startBalance, ...actualData], borderColor: 'blue', fill: false },
                { label: 'Doelbalans', data: targetData, borderColor: 'green', borderDash: [5, 5], fill: false }
            ]
        },
        options: { scales: { y: { beginAtZero: false } } }
    });
    console.log("Grafiek succesvol bijgewerkt");
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

function updateStartBalanceDisplay() {
    const display = document.getElementById('start-balance-display');
    if (display) {
        if (settings.startBalance) {
            display.textContent = `Huidige beginstand: €${formatNumber(settings.startBalance)}`;
        } else {
            display.textContent = 'Huidige beginstand: Nog niet ingesteld';
        }
    }
}

function resetData() {
    if (confirm("Weet je zeker dat je alles wilt resetten?")) {
        localStorage.clear();
        settings = {};
        entries = [];
        if (growthChart) growthChart.destroy();
        document.getElementById('start-balance').value = '';
        document.getElementById('target-percentage').value = '1';
        document.getElementById('end-balance').value = '';
        updateStartBalanceDisplay();
        updateHistoryTable();
        updateCurrentWeekOverview();
        updateWeekOverview();
        console.log("Alle gegevens gereset");
    }
}

function updateHistoryTable() {
    const tbody = document.getElementById('history-body');
    if (!tbody) return;

    tbody.innerHTML = '';
    let previousBalance = settings.startBalance || 0;
    let targetBalance = settings.startBalance || 0;

    const sortedEntries = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedEntries.forEach((entry, index) => {
        if (index === 0) {
            targetBalance = settings.startBalance * Math.pow(1 + (settings.targetPercentage || 0) / 100, entries.length);
        } else {
            targetBalance /= (1 + (settings.targetPercentage || 0) / 100);
        }

        const profitLossAbsolute = entry.endBalance - previousBalance;
        const profitLossPercentage = previousBalance !== 0 ? (profitLossAbsolute / previousBalance * 100).toFixed(1) : 0;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(entry.date).toLocaleDateString()}</td>
            <td>${formatNumber(entry.endBalance)}</td>
            <td>${formatNumber(targetBalance)}</td>
            <td>${formatNumber(profitLossAbsolute)}</td>
            <td>${profitLossPercentage}%</td>
            <td>
                <button onclick="editEntry(${entries.indexOf(entry)})">Wijzig</button>
                <button onclick="deleteEntry(${entries.indexOf(entry)})">Verwijder</button>
            </td>
        `;
        tbody.appendChild(row);
        previousBalance = entry.endBalance;
    });
}

function editEntry(index) {
    const modal = document.getElementById('edit-modal');
    if (!modal) return;

    const currentEntry = entries[index];
    const dateInput = document.getElementById('edit-date');
    const balanceInput = document.getElementById('edit-balance');
    const indexInput = document.getElementById('edit-index');

    dateInput.value = new Date(currentEntry.date).toISOString().split('T')[0];
    balanceInput.value = currentEntry.endBalance;
    indexInput.value = index;

    modal.style.display = 'block';
}

function deleteEntry(index) {
    if (confirm("Weet je zeker dat je deze invoer wilt verwijderen?")) {
        entries.splice(index, 1);
        localStorage.setItem('entries', JSON.stringify(entries));
        console.log("Entry verwijderd, resterende entries:", entries);
        updateChart();
        updateCurrentWeekOverview();
        updateHistoryTable();
        updateWeekOverview();
    }
}

function updateCurrentWeekOverview() {
    const tbody = document.getElementById('current-week-results-body');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    if (!tbody) return;

    if (!settings.startBalance || entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9">Geen data beschikbaar</td></tr>';
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '';
        return;
    }

    const today = new Date();
    const currentWeekNumber = getWeekNumber(today);
    const currentWeekKey = `${today.getFullYear()}-W${currentWeekNumber}`;

    const weeks = {};
    let previousBalance = settings.startBalance;
    entries.forEach(entry => {
        const date = new Date(entry.date);
        const weekNumber = getWeekNumber(date);
        const weekKey = `${date.getFullYear()}-W${weekNumber}`;
        if (!weeks[weekKey]) weeks[weekKey] = {};
        const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
        const profitLossAbsolute = entry.endBalance - previousBalance;
        const profitLossPercentage = previousBalance !== 0 ? (profitLossAbsolute / previousBalance * 100).toFixed(1) : 0;
        weeks[weekKey][dayIndex] = { absolute: profitLossAbsolute, percentage: profitLossPercentage };
        previousBalance = entry.endBalance;
    });

    tbody.innerHTML = '';
    const currentWeekDays = weeks[currentWeekKey] || {};
    const row = document.createElement('tr');
    row.innerHTML = `<td>${currentWeekKey}</td>`;
    for (let i = 0; i < 7; i++) {
        const dayData = currentWeekDays[i] || { absolute: '', percentage: '' };
        const cellClass = dayData.absolute > 0 ? 'positive' : dayData.absolute < 0 ? 'negative' : '';
        row.innerHTML += `
            <td class="${cellClass}">
                ${dayData.absolute !== '' ? `€${formatNumber(dayData.absolute)}<br><span class="percentage">${dayData.percentage}%</span>` : '-'}
            </td>
        `;
    }

    const weekStart = currentWeekKey === Object.keys(weeks)[Object.keys(weeks).length - 1] ? settings.startBalance : entries.find(e => new Date(e.date).getWeekNumber() === parseInt(currentWeekKey.split('-W')[1]) - 1)?.endBalance || settings.startBalance;
    const weekTotal = Object.values(currentWeekDays).reduce((sum, day) => sum + (day.absolute || 0), 0);
    const weekTargetProfit = weekStart * (Math.pow(1 + settings.targetPercentage / 100, 7) - 1);
    const weekTotalPercentage = weekStart > 0 ? (weekTotal / weekStart * 100).toFixed(1) : 0;

    const totalClass = weekTotal > 0 ? 'positive' : weekTotal < 0 ? 'negative' : '';
    row.innerHTML += `
        <td class="${totalClass}">
            €${formatNumber(weekTotal)}<br><span class="percentage">${weekTotalPercentage}%</span>
        </td>
    `;
    tbody.appendChild(row);

    const weekProgressPercentage = weekTargetProfit > 0 ? (weekTotal / weekTargetProfit * 100).toFixed(1) : 0;
    if (progressFill && progressText) {
        progressFill.style.width = `${Math.min(Math.max(weekProgressPercentage, 0), 100)}%`;
        progressFill.style.backgroundColor = weekProgressPercentage >= 100 ? '#2ecc71' : weekProgressPercentage > 0 ? '#f1c40f' : '#e74c3c';
        progressText.textContent = `€${formatNumber(weekTotal)} (${weekProgressPercentage}%)`;
    }
}

function updateWeekOverview() {
    const goalDisplay = document.getElementById('weekly-goal');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const tbody = document.getElementById('week-results-body');

    if (!tbody) return;

    if (!settings.startBalance || entries.length === 0) {
        if (goalDisplay) goalDisplay.textContent = 'Wekelijkse winstdoel: Nog niet berekend';
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '';
        tbody.innerHTML = '<tr><td colspan="9">Geen data beschikbaar</td></tr>';
        return;
    }

    const weeks = {};
    let previousBalance = settings.startBalance;
    entries.forEach(entry => {
        const date = new Date(entry.date);
        const weekNumber = getWeekNumber(date);
        const weekKey = `${date.getFullYear()}-W${weekNumber}`;
        if (!weeks[weekKey]) weeks[weekKey] = {};
        const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
        const profitLossAbsolute = entry.endBalance - previousBalance;
        const profitLossPercentage = previousBalance !== 0 ? (profitLossAbsolute / previousBalance * 100).toFixed(1) : 0;
        weeks[weekKey][dayIndex] = { absolute: profitLossAbsolute, percentage: profitLossPercentage };
        previousBalance = entry.endBalance;
    });

    tbody.innerHTML = '';
    let overallProfit = 0;
    let totalTargetProfit = 0;

    const sortedWeeks = Object.keys(weeks).sort((a, b) => b.localeCompare(a));

    for (const week of sortedWeeks) {
        const days = weeks[week];
        const row = document.createElement('tr');
        row.innerHTML = `<td>${week}</td>`;
        for (let i = 0; i < 7; i++) {
            const dayData = days[i] || { absolute: '', percentage: '' };
            const cellClass = dayData.absolute > 0 ? 'positive' : dayData.absolute < 0 ? 'negative' : '';
            row.innerHTML += `
                <td class="${cellClass}">
                    ${dayData.absolute !== '' ? `€${formatNumber(dayData.absolute)}<br><span class="percentage">${dayData.percentage}%</span>` : '-'}
                </td>
            `;
        }

        const weekStart = week === sortedWeeks[sortedWeeks.length - 1] ? settings.startBalance : entries.find(e => new Date(e.date).getWeekNumber() === parseInt(week.split('-W')[1]) - 1)?.endBalance || settings.startBalance;
        const weekTotal = Object.values(days).reduce((sum, day) => sum + (day.absolute || 0), 0);
        const weekTargetProfit = weekStart * (Math.pow(1 + settings.targetPercentage / 100, 7) - 1);
        const weekTotalPercentage = weekStart > 0 ? (weekTotal / weekStart * 100).toFixed(1) : 0;

        const totalClass = weekTotal > 0 ? 'positive' : weekTotal < 0 ? 'negative' : '';
        row.innerHTML += `
            <td class="${totalClass}">
                €${formatNumber(weekTotal)}<br><span class="percentage">${weekTotalPercentage}%</span>
            </td>
        `;
        tbody.appendChild(row);

        overallProfit += weekTotal;
        totalTargetProfit += weekTargetProfit;
    }

    const lastWeek = sortedWeeks[0];
    const lastWeekDays = weeks[lastWeek];
    const lastWeekStart = lastWeek === sortedWeeks[sortedWeeks.length - 1] ? settings.startBalance : entries.find(e => new Date(e.date).getWeekNumber() === parseInt(lastWeek.split('-W')[1]) - 1)?.endBalance || settings.startBalance;
    const lastWeekProfit = Object.values(lastWeekDays).reduce((sum, day) => sum + (day.absolute || 0), 0);
    const lastWeekTargetProfit = lastWeekStart * (Math.pow(1 + settings.targetPercentage / 100, 7) - 1);
    const lastWeekProgressPercentage = lastWeekTargetProfit > 0 ? (lastWeekProfit / lastWeekTargetProfit * 100).toFixed(1) : 0;

    if (goalDisplay) goalDisplay.textContent = `Wekelijkse winstdoel (laatste week): €${formatNumber(lastWeekTargetProfit)}`;
    if (progressFill && progressText) {
        progressFill.style.width = `${Math.min(Math.max(lastWeekProgressPercentage, 0), 100)}%`;
        progressFill.style.backgroundColor = lastWeekProgressPercentage >= 100 ? '#2ecc71' : lastWeekProgressPercentage > 0 ? '#f1c40f' : '#e74c3c';
        progressText.textContent = `€${formatNumber(lastWeekProfit)} (${lastWeekProgressPercentage}%)`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM geladen, initialiseren...");
    const modal = document.getElementById('edit-modal');
    const closeBtn = document.getElementById('close-modal');
    const cancelBtn = document.getElementById('cancel-edit');
    const editForm = document.getElementById('edit-form');

    if (modal && closeBtn && cancelBtn && editForm) {
        closeBtn.onclick = () => modal.style.display = 'none';
        cancelBtn.onclick = () => modal.style.display = 'none';
        window.onclick = (event) => {
            if (event.target === modal) modal.style.display = 'none';
        };
        editForm.onsubmit = (event) => {
            event.preventDefault();
            const index = parseInt(document.getElementById('edit-index').value);
            const newDate = document.getElementById('edit-date').value;
            const newBalance = parseFloat(document.getElementById('edit-balance').value);

            if (!isNaN(newBalance) && new Date(newDate).getTime()) {
                entries[index].date = new Date(newDate).toISOString();
                entries[index].endBalance = newBalance;
                localStorage.setItem('entries', JSON.stringify(entries));
                console.log("Entry gewijzigd:", entries[index]);
                updateChart();
                updateCurrentWeekOverview();
                updateHistoryTable();
                updateWeekOverview();
                modal.style.display = 'none';
            } else {
                alert("Voer een geldige datum en eindbalans in!");
            }
        };
    }

    // Initialiseren
    updateStartBalanceDisplay();
    if (settings.startBalance) {
        updateChart();
    }
    if (entries.length > 0) {
        updateCurrentWeekOverview();
        updateHistoryTable();
        updateWeekOverview();
    }
});

Date.prototype.getWeekNumber = function() {
    const d = new Date(Date.UTC(this.getFullYear(), this.getMonth(), this.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
};