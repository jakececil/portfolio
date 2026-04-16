const stage = document.getElementById('archiveStage');
const viewButtons = document.querySelectorAll('[data-view]');
const shuffleButton = document.getElementById('shuffleButton');
const collectionToggles = document.getElementById('collectionToggles');
const collectionStatus = document.getElementById('collectionStatus');
const viewerOverlay = document.getElementById('viewerOverlay');
const viewerBackdrop = document.getElementById('viewerBackdrop');
const viewerClose = document.getElementById('viewerClose');
const viewerImage = document.getElementById('viewerImage');
const viewerCounter = document.getElementById('viewerCounter');
const viewerCollection = document.getElementById('viewerCollection');
const viewerPrev = document.getElementById('viewerPrev');
const viewerNext = document.getElementById('viewerNext');

let currentView = 'grid';
let previousView = 'grid';
let allAssets = [];
let visibleAssets = [];
let collections = [];
let selectedCollections = new Set();
let activeIndex = 0;
let lastArrangement = 'interleave';

async function loadAssets() {
  const response = await fetch('assets/data/assets.json');
  allAssets = await response.json();
  collections = [...new Set(allAssets.map(asset => asset.collection))];
  collections.forEach(name => selectedCollections.add(name));
  renderCollectionControls();
  rebuildVisibleAssets({ arrangement: 'interleave', animate: false, preserveActive: false });
}

function sortByCollectionThenOrder(a, b) {
  const collectionCompare = String(a.collection).localeCompare(String(b.collection));
  if (collectionCompare !== 0) return collectionCompare;
  return (a.order ?? 9999) - (b.order ?? 9999);
}

function getAssetSrc(asset) {
  return `assets/images/archive/${asset.path || asset.file}`;
}

function collectionLabel(name) {
  return String(name || '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function renderCollectionControls() {
  collectionToggles.innerHTML = '';
  collections.forEach(name => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `collection-chip${selectedCollections.has(name) ? ' is-active' : ''}`;
    button.dataset.collection = name;
    button.innerHTML = `<span>${collectionLabel(name)}</span><span class="collection-chip__count">${allAssets.filter(asset => asset.collection === name).length}</span>`;
    button.addEventListener('click', () => toggleCollection(name));
    collectionToggles.appendChild(button);
  });
  updateCollectionStatus();
}

function updateCollectionStatus() {
  const selected = collections.filter(name => selectedCollections.has(name));
  const count = visibleAssets.length;
  if (!selected.length) {
    collectionStatus.textContent = 'No collections selected.';
    return;
  }
  const label = selected.length === 1
    ? `${collectionLabel(selected[0])} only`
    : `${selected.length} collections active`;
  collectionStatus.textContent = `${label} · ${count} objects in the field`;
}

function toggleCollection(name) {
  if (selectedCollections.has(name)) {
    if (selectedCollections.size === 1) return;
    selectedCollections.delete(name);
  } else {
    selectedCollections.add(name);
  }
  renderCollectionControls();
  rebuildVisibleAssets({ arrangement: 'interleave', animate: true, preserveActive: false });
}

function rebuildVisibleAssets({ arrangement = lastArrangement, animate = true, preserveActive = true } = {}) {
  const currentAssetId = preserveActive ? visibleAssets[activeIndex]?.id : null;
  const selected = collections.filter(name => selectedCollections.has(name));
  const grouped = selected.map(name => allAssets
    .filter(asset => asset.collection === name)
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999))
  );

  if (arrangement === 'shuffle') {
    visibleAssets = grouped.flat().sort(() => Math.random() - 0.5);
  } else {
    visibleAssets = interleaveGroups(grouped);
  }

  lastArrangement = arrangement;

  if (!visibleAssets.length) {
    activeIndex = 0;
  } else if (currentAssetId) {
    const foundIndex = visibleAssets.findIndex(asset => asset.id === currentAssetId);
    activeIndex = foundIndex >= 0 ? foundIndex : 0;
  } else {
    activeIndex = 0;
  }

  updateCollectionStatus();
  render(animate);
  if (viewerOverlay.classList.contains('is-open') && visibleAssets.length) {
    openViewer(activeIndex, false);
  }
}

function interleaveGroups(groups) {
  const queues = groups.map(group => [...group]);
  const mixed = [];
  let keepGoing = true;
  while (keepGoing) {
    keepGoing = false;
    for (const queue of queues) {
      if (queue.length) {
        mixed.push(queue.shift());
        keepGoing = true;
      }
    }
  }
  return mixed;
}

function shuffleAssets() {
  rebuildVisibleAssets({ arrangement: 'shuffle', animate: true, preserveActive: true });
}

function setView(view, animate = true) {
  currentView = view;
  stage.classList.toggle('view-grid', view === 'grid');
  stage.classList.toggle('view-single', view === 'single');
  viewButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === view));
  render(animate);
}

function render(animate = false) {
  stage.innerHTML = '';
  if (animate) {
    stage.classList.add('is-transitioning');
    window.setTimeout(() => stage.classList.remove('is-transitioning'), 260);
  }
  if (!visibleAssets.length) {
    renderEmpty();
    return;
  }
  if (currentView === 'grid') {
    renderGrid();
  } else {
    renderSingle();
  }
}

function renderEmpty() {
  const empty = document.createElement('div');
  empty.className = 'archive-empty';
  empty.innerHTML = '<p>Select at least one collection to repopulate the field.</p>';
  stage.appendChild(empty);
}

function renderGrid() {
  visibleAssets.forEach((asset, index) => {
    const cell = document.createElement('button');
    cell.className = 'void-cell';
    cell.type = 'button';
    cell.style.setProperty('--stagger', `${Math.min(index * 16, 420)}ms`);
    cell.setAttribute('aria-label', `Open image ${index + 1} in single view`);
    cell.innerHTML = `<img src="${getAssetSrc(asset)}" alt="${asset.id || `Image ${index + 1}`}" loading="lazy" />`;
    cell.addEventListener('click', () => {
      activeIndex = index;
      previousView = 'grid';
      openViewer(index);
    });
    stage.appendChild(cell);
  });
}

function renderSingle() {
  const asset = visibleAssets[activeIndex];
  const wrapper = document.createElement('article');
  wrapper.className = 'single-void';
  wrapper.innerHTML = `
    <div class="single-void-controls">
      <button class="button small ghost" id="singleBack">Back to grid</button>
      <span class="single-counter">${activeIndex + 1} / ${visibleAssets.length}</span>
      <span class="single-collection-pill">${collectionLabel(asset.collection)}</span>
    </div>
    <button class="single-void-stage" id="singleOpen" aria-label="Expand image to focused view">
      <img src="${getAssetSrc(asset)}" alt="${asset.id || `Image ${activeIndex + 1}`}" />
    </button>
  `;
  stage.appendChild(wrapper);
  wrapper.querySelector('#singleBack').addEventListener('click', () => {
    previousView = 'grid';
    closeViewer();
    setView('grid');
  });
  wrapper.querySelector('#singleOpen').addEventListener('click', () => openViewer(activeIndex));
}

function openViewer(index, updateView = true) {
  if (!visibleAssets.length) return;
  activeIndex = index;
  const asset = visibleAssets[activeIndex];
  viewerImage.src = getAssetSrc(asset);
  viewerImage.alt = asset.id || `Image ${activeIndex + 1}`;
  viewerCounter.textContent = `${activeIndex + 1} / ${visibleAssets.length}`;
  viewerCollection.textContent = collectionLabel(asset.collection);
  viewerOverlay.classList.add('is-open');
  viewerOverlay.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  if (updateView) {
    previousView = currentView;
    viewButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === currentView));
  }
}

function closeViewer() {
  viewerOverlay.classList.remove('is-open');
  viewerOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  viewButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.view === currentView));
}

function stepAsset(direction) {
  if (!visibleAssets.length) return;
  activeIndex = (activeIndex + direction + visibleAssets.length) % visibleAssets.length;
  openViewer(activeIndex, false);
  if (currentView === 'single') {
    render(false);
  }
}

viewButtons.forEach(btn => btn.addEventListener('click', () => {
  const targetView = btn.dataset.view;
  if (targetView === 'single') {
    previousView = 'grid';
    setView('single');
  } else {
    closeViewer();
    setView('grid');
  }
}));

shuffleButton.addEventListener('click', shuffleAssets);
viewerBackdrop.addEventListener('click', () => closeViewer());
viewerClose.addEventListener('click', () => closeViewer());
viewerPrev.addEventListener('click', () => stepAsset(-1));
viewerNext.addEventListener('click', () => stepAsset(1));

document.addEventListener('keydown', (event) => {
  if (!viewerOverlay.classList.contains('is-open')) return;
  if (event.key === 'Escape') {
    closeViewer();
  } else if (event.key === 'ArrowLeft') {
    stepAsset(-1);
  } else if (event.key === 'ArrowRight') {
    stepAsset(1);
  }
});

loadAssets();
