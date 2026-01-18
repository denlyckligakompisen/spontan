// Paste this in browser console to measure button positions
const container = document.querySelector('.view-toggle');
const buttons = Array.from(document.querySelectorAll('.toggle-btn'));
const underline = document.querySelector('.view-toggle-underline');

const containerCenter = container.getBoundingClientRect().left + container.getBoundingClientRect().width / 2;

buttons.forEach((btn, i) => {
    const rect = btn.getBoundingClientRect();
    const btnCenter = rect.left + rect.width / 2;
    const offset = btnCenter - containerCenter;
    console.log(`${btn.textContent.trim()}: center offset = ${offset.toFixed(2)}px (${(offset / 16).toFixed(2)}rem)`);
});

console.log('Underline width:', underline.getBoundingClientRect().width);
