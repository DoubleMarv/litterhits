/* =========================================================
   Greatest Hits — Ireland's Litter Charts
   Edit HITS below to update the Top 5. Order = rank.
   image: path to a photo (e.g. "images/hit-1.jpg") or "" for a placeholder.
   move:  "up", "down", "new" or "" (shown as a badge on the card).
   SAMPLE DATA — replace with your reviewed reports.
   ========================================================= */

const HITS = [
  {
    title: 'The Takeaway Toss',
    place: 'Lay-by on the N25',
    county: 'Cork',
    lat: 51.9035,
    lng: -8.2120,
    blurb: 'Bags of chips eaten in the car, then left for the seagulls. A chart regular.',
    tags: ['Takeaway bags', 'Cans', 'Cups'],
    reports: 42,
    move: 'up',
    image: ''
  },
  {
    title: 'Summer Strand Special',
    place: 'Salthill Prom',
    county: 'Galway',
    lat: 53.2585,
    lng: -9.0830,
    blurb: 'Every sunny weekend brings a fresh pressing of disposable barbecues and bottles.',
    tags: ['BBQs', 'Bottles'],
    reports: 35,
    move: 'new',
    image: ''
  },
  {
    title: 'Cans by the Canal',
    place: 'Grand Canal towpath',
    county: 'Dublin',
    lat: 53.3320,
    lng: -6.2580,
    blurb: 'A late-night favourite. Cans lined up along the bank like a backing band.',
    tags: ['Cans', 'Glass'],
    reports: 29,
    move: 'down',
    image: ''
  },
  {
    title: 'Bag on a Branch',
    place: 'Bog road',
    county: 'Offaly',
    lat: 53.2700,
    lng: -7.6000,
    blurb: 'Black sacks dumped in the ditch, one now permanently hanging in a hawthorn.',
    tags: ['Black bags', 'Fly-tipping'],
    reports: 21,
    move: '',
    image: ''
  },
  {
    title: 'The Fly-tip Encore',
    place: 'Mountain car park',
    county: 'Wicklow',
    lat: 53.0800,
    lng: -6.4000,
    blurb: 'Cleared in spring, back by summer: a mattress, two tyres and half a kitchen.',
    tags: ['Mattress', 'Tyres', 'Bulky waste'],
    reports: 17,
    move: 'up',
    image: ''
  }
];

const COUNTIES = [
  'Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry', 'Donegal',
  'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry', 'Kildare', 'Kilkenny',
  'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath',
  'Monaghan', 'Offaly', 'Roscommon', 'Sligo', 'Tipperary', 'Tyrone',
  'Waterford', 'Westmeath', 'Wexford', 'Wicklow'
];

const FORM_ENDPOINT = '/api/report';
const MAX_IMAGE_EDGE = 1600;   // px — photos are resized before upload
const JPEG_QUALITY = 0.82;

/* ---------- Helpers ---------- */

const $ = (sel) => document.querySelector(sel);

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const MOVE_LABEL = { up: '&#9650; Climbing', down: '&#9660; Falling', new: 'New entry' };

/* ---------- Cards ---------- */

function renderCards() {
  const list = $('#cards');
  list.innerHTML = HITS.map((hit, i) => {
    const rank = i + 1;
    const media = hit.image
      ? `<img src="${esc(hit.image)}" alt="${esc(hit.title)}, ${esc(hit.place)}" loading="lazy">`
      : '<div class="placeholder">Photo coming soon</div>';
    const move = hit.move && MOVE_LABEL[hit.move]
      ? `<span class="move ${esc(hit.move)}">${MOVE_LABEL[hit.move]}</span>`
      : '';
    const tags = (hit.tags || []).map((t) => `<li>${esc(t)}</li>`).join('');

    return `
      <li class="card" tabindex="0" data-index="${i}" aria-label="Number ${rank}: ${esc(hit.title)}">
        <div class="card-media">
          ${media}
          <span class="rank">${rank}</span>
          ${move}
        </div>
        <div class="card-body">
          <h3 class="card-title">${esc(hit.title)}</h3>
          <p class="card-place">${esc(hit.place)}, Co. ${esc(hit.county)}</p>
          <p class="card-blurb">${esc(hit.blurb)}</p>
          <ul class="card-meta">
            <li class="count">${Number(hit.reports) || 0} reports</li>
            ${tags}
          </ul>
        </div>
      </li>`;
  }).join('');

  list.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) focusHit(Number(card.dataset.index));
  });

  list.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest('.card');
    if (!card) return;
    e.preventDefault();
    focusHit(Number(card.dataset.index));
  });
}

/* ---------- Map ---------- */

let map = null;
let reportMarker = null;
const hitMarkers = [];

function pinIcon(label, extraClass) {
  const size = extraClass === 'is-top' ? 46 : 36;
  return L.divIcon({
    className: '',
    html: `<div class="map-pin ${extraClass || ''}">${label}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

function initMap() {
  if (typeof L === 'undefined') {
    $('#map').innerHTML = '<p style="padding:24px">The map could not load.</p>';
    return;
  }

  // Island of Ireland bounds
  const ireland = L.latLngBounds([51.35, -10.75], [55.45, -5.35]);

  map = L.map('map', {
    scrollWheelZoom: false,
    zoomSnap: 0.25,
    maxBounds: ireland.pad(0.4),
    minZoom: 6
  }).fitBounds(ireland);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  HITS.forEach((hit, i) => {
    const marker = L.marker([hit.lat, hit.lng], {
      icon: pinIcon(i + 1, i === 0 ? 'is-top' : ''),
      zIndexOffset: 1000 - i,
      title: `${i + 1}. ${hit.title}`
    })
      .addTo(map)
      .bindPopup(`<strong>${i + 1}. ${esc(hit.title)}</strong>${esc(hit.place)}, Co. ${esc(hit.county)}<br>${Number(hit.reports) || 0} reports`);
    hitMarkers.push(marker);
  });

  // Click the map to pin a report location
  map.on('click', (e) => setReportPin(e.latlng.lat, e.latlng.lng, 'Pinned from the map'));
}

function focusHit(index) {
  const hit = HITS[index];
  if (!map || !hit) return;
  $('#map-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  map.flyTo([hit.lat, hit.lng], 11, { duration: 1.2 });
  hitMarkers[index].openPopup();
}

function setReportPin(lat, lng, source) {
  $('#lat').value = lat.toFixed(6);
  $('#lng').value = lng.toFixed(6);
  $('#pin-status').textContent = `${source}: ${lat.toFixed(5)}, ${lng.toFixed(5)}`;

  if (!map) return;
  if (reportMarker) {
    reportMarker.setLatLng([lat, lng]);
  } else {
    reportMarker = L.marker([lat, lng], { icon: pinIcon('New', 'is-report'), zIndexOffset: 2000 })
      .addTo(map)
      .bindPopup('<strong>Your report</strong>This pin will be sent with your form.');
  }
}

/* ---------- Form ---------- */

function initForm() {
  const form = $('#report-form');
  const photoInput = $('#photo');
  const preview = $('#photo-preview');
  const dropText = $('#dropzone-text');
  const dropzone = $('#dropzone');
  const status = $('#form-status');
  const submitBtn = $('#submit-btn');

  $('#county').insertAdjacentHTML(
    'beforeend',
    COUNTIES.map((c) => `<option value="${c}">${c}</option>`).join('')
  );

  // Photo preview
  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) {
      preview.hidden = true;
      dropText.hidden = false;
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    dropText.hidden = true;
    photoInput.closest('.field').classList.remove('has-error');
  });

  ['dragenter', 'dragover'].forEach((ev) =>
    dropzone.addEventListener(ev, () => dropzone.classList.add('is-over')));
  ['dragleave', 'drop'].forEach((ev) =>
    dropzone.addEventListener(ev, () => dropzone.classList.remove('is-over')));

  // Geolocation
  $('#geo-btn').addEventListener('click', () => {
    if (!navigator.geolocation) {
      $('#pin-status').textContent = 'Your browser does not support location.';
      return;
    }
    $('#pin-status').textContent = 'Finding you...';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setReportPin(pos.coords.latitude, pos.coords.longitude, 'Your location');
        if (map) map.flyTo([pos.coords.latitude, pos.coords.longitude], 13);
      },
      () => {
        $('#pin-status').textContent = 'Could not get your location. You can click the map instead.';
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    status.className = 'form-status';
    status.textContent = '';

    // Validation
    let ok = true;
    const photo = photoInput.files[0];
    const location = $('#location').value.trim();

    form.querySelectorAll('.has-error').forEach((el) => el.classList.remove('has-error'));

    if (!photo || !photo.type.startsWith('image/')) {
      photoInput.closest('.field').classList.add('has-error');
      ok = false;
    }
    if (!location) {
      $('#location').closest('.field').classList.add('has-error');
      ok = false;
    }
    const email = $('#email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $('#email').closest('.field').classList.add('has-error');
      ok = false;
    }
    if (!ok) {
      status.classList.add('is-error');
      status.textContent = 'Please add a photo and say where it is.';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';

    try {
      const data = new FormData(form);
      const resized = await resizeImage(photo);
      data.set('photo', resized, resized.name);

      const res = await fetch(FORM_ENDPOINT, { method: 'POST', body: data });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.ok) throw new Error(json.error || 'Something went wrong.');

      form.reset();
      preview.hidden = true;
      dropText.hidden = false;
      $('#pin-status').textContent = '';
      if (reportMarker && map) {
        map.removeLayer(reportMarker);
        reportMarker = null;
      }
      status.classList.add('is-ok');
      status.textContent = 'Thanks, your report is in. We review every one before it goes up.';
    } catch (err) {
      status.classList.add('is-error');
      status.textContent = err.message || 'Something went wrong. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send report';
    }
  });
}

// Shrinks the photo to MAX_IMAGE_EDGE and converts to JPEG, so uploads stay
// small (phone photos are often 4-10 MB). Falls back to the original file.
async function resizeImage(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) return file;
    const base = (file.name || 'litter-spot').replace(/\.[^.]+$/, '');
    return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/* ---------- Go ---------- */

renderCards();
initMap();
initForm();
