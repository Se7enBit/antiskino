// Drawn stand-ins for camping photos (SVG, 1200 × 800): sea, pines, mountains.
const tent = (x, y, s, c1, c2) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 L60 -70 L120 0 Z" fill="${c1}"/><path d="M60 -70 L60 0 L85 0 Z" fill="${c2}"/><path d="M52 0 L60 -22 L68 0Z" fill="#2b2b2b" opacity=".55"/></g>`;
const pine = (x, y, s, c = '#2f5d3a') =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-5" y="-10" width="10" height="30" fill="#5b4330"/><path d="M0 -150 L45 -60 L25 -60 L55 -10 L-55 -10 L-25 -60 L-45 -60 Z" fill="${c}"/></g>`;
const olive = (x, y, s) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-4 0 C-6 -30 6 -40 2 -70 L8 -70 C12 -40 4 -30 6 0Z" fill="#6b5844"/><ellipse cx="0" cy="-90" rx="60" ry="38" fill="#7d9a6a"/><ellipse cx="-30" cy="-75" rx="35" ry="24" fill="#8aa877"/><ellipse cx="32" cy="-78" rx="34" ry="22" fill="#6f8d5d"/></g>`;
const caravan = (x, y, s, c) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><rect x="0" y="-70" width="150" height="62" rx="22" fill="${c}"/><rect x="18" y="-56" width="36" height="22" rx="5" fill="#cfe6f2"/><rect x="70" y="-56" width="26" height="40" rx="4" fill="#e9e2d0"/><rect x="0" y="-30" width="150" height="6" fill="#d9573b" opacity=".8"/><circle cx="45" cy="-6" r="13" fill="#2b2b2b"/><circle cx="45" cy="-6" r="5" fill="#999"/><rect x="150" y="-14" width="30" height="4" fill="#555"/></g>`;
const camper = (x, y, s, c) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -60 Q0 -95 30 -95 L150 -95 L150 -10 L0 -10 Z" fill="${c}"/><path d="M150 -70 L190 -70 L205 -40 L205 -10 L150 -10Z" fill="${c}"/><path d="M158 -64 L186 -64 L197 -42 L158 -42Z" fill="#cfe6f2"/><rect x="20" y="-75" width="40" height="22" rx="5" fill="#cfe6f2"/><rect x="0" y="-38" width="205" height="7" fill="#1f6f4a"/><circle cx="45" cy="-8" r="15" fill="#2b2b2b"/><circle cx="165" cy="-8" r="15" fill="#2b2b2b"/></g>`;
const svg = (body, sky1, sky2) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient></defs><rect width="1200" height="800" fill="url(#sky)"/>${body}</svg>`;
module.exports = {
  'thalassa-1': svg(
    `<circle cx="930" cy="170" r="70" fill="#fff2c4"/>
    <path d="M0 360 Q300 330 600 350 T1200 345 L1200 480 L0 480Z" fill="#2f8fb3"/><path d="M0 400 Q300 380 600 395 T1200 390 L1200 480 L0 480Z" fill="#3aa3c4"/>
    <path d="M0 470 Q400 430 800 460 T1200 450 L1200 800 L0 800Z" fill="#e8d6a8"/><path d="M0 560 Q500 520 1200 560 L1200 800 L0 800Z" fill="#d9c58f"/>
    ${pine(90, 560, 1.6)}${pine(230, 600, 1.2, '#3a6d45')}${pine(1110, 580, 1.5)}${pine(980, 640, 1.0, '#3a6d45')}
    ${tent(380, 640, 1.6, '#e07a3f', '#c4612a')}${tent(620, 610, 1.3, '#2f7f5b', '#246548')}${tent(780, 690, 1.8, '#f1c84b', '#d9ab2c')}`,
    '#8fd0ef',
    '#e7f5fb',
  ),
  'thalassa-2': svg(
    `<circle cx="300" cy="230" r="90" fill="#ffd58a"/>
    <path d="M0 420 Q600 400 1200 420 L1200 520 L0 520Z" fill="#e0884f"/><path d="M0 450 Q600 430 1200 455 L1200 560 L0 560Z" fill="#2e7fa3"/>
    <path d="M0 540 Q600 500 1200 540 L1200 800 L0 800Z" fill="#c9b07c"/>
    ${olive(160, 690, 1.6)}${olive(1050, 700, 1.8)}${tent(470, 720, 1.5, '#2f7f5b', '#246548')}${caravan(700, 740, 1.4, '#f4efe2')}`,
    '#f2a46b',
    '#fde2c2',
  ),
  'pefka-1': svg(
    `<path d="M0 420 L250 250 L470 400 L700 220 L960 410 L1200 300 L1200 800 L0 800Z" fill="#7aa6a0" opacity=".7"/>
    <path d="M0 520 Q600 470 1200 520 L1200 800 L0 800Z" fill="#7fae5c"/>
    ${pine(80, 640, 2.0)}${pine(260, 560, 1.5, '#3a6d45')}${pine(1000, 600, 1.9)}${pine(1150, 680, 2.2, '#264d31')}${pine(860, 520, 1.2, '#3a6d45')}
    ${caravan(420, 680, 1.8, '#f4efe2')}${tent(740, 700, 1.5, '#e07a3f', '#c4612a')}`,
    '#9cd3e6',
    '#eef8f3',
  ),
  'kastri-1': svg(
    `<path d="M0 380 L200 180 L360 330 L560 120 L800 350 L980 200 L1200 380 L1200 800 L0 800Z" fill="#8a9fb3"/><path d="M500 170 L560 120 L620 178 L590 170 L560 190Z" fill="#fff"/>
    <path d="M0 470 Q600 440 1200 470 L1200 560 L0 560Z" fill="#4a95b8"/>
    <path d="M0 540 Q600 510 1200 540 L1200 800 L0 800Z" fill="#8bbf6a"/>
    ${pine(120, 650, 1.7)}${pine(1080, 640, 1.8, '#264d31')}${camper(380, 720, 1.9, '#f4efe2')}${tent(820, 700, 1.4, '#f1c84b', '#d9ab2c')}`,
    '#b9def0',
    '#f3fafc',
  ),
};
