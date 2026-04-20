import { searchPlaces, type PlaceResult } from '../search/kakaoSearch';
import { flyToPoint } from '../map/mapView';
import { setUserLocation } from '../gallery/galleryView';
import { debounce } from '../draw/debounce';

export function createLocationSearch(container: HTMLElement, apiKey: string): void {
  const wrap = document.createElement('div');
  wrap.className = 'location-search';

  const inputWrap = document.createElement('div');
  inputWrap.className = 'location-search__input-wrap';

  const icon = document.createElement('span');
  icon.className = 'location-search__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"/>
    <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'location-search__input';
  input.placeholder = '뛰기 시작할 위치 검색';
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('aria-label', '위치 검색');

  inputWrap.appendChild(icon);
  inputWrap.appendChild(input);

  const dropdown = document.createElement('ul');
  dropdown.className = 'location-search__dropdown';
  dropdown.setAttribute('role', 'listbox');

  wrap.appendChild(inputWrap);
  wrap.appendChild(dropdown);
  container.appendChild(wrap);

  let currentResults: PlaceResult[] = [];
  let selectedIndex = -1;

  function hideDropdown(): void {
    dropdown.hidden = true;
    selectedIndex = -1;
  }

  function showResults(results: PlaceResult[]): void {
    currentResults = results;
    selectedIndex = -1;
    dropdown.innerHTML = '';

    if (results.length === 0) {
      hideDropdown();
      return;
    }

    for (let i = 0; i < results.length; i++) {
      const place = results[i];
      const li = document.createElement('li');
      li.className = 'location-search__item';
      li.setAttribute('role', 'option');
      li.dataset.index = String(i);

      const nameEl = document.createElement('span');
      nameEl.className = 'location-search__item-name';
      nameEl.textContent = place.name;

      const addrEl = document.createElement('span');
      addrEl.className = 'location-search__item-addr';
      addrEl.textContent = place.address;

      li.appendChild(nameEl);
      if (place.address && place.address !== place.name) li.appendChild(addrEl);

      li.addEventListener('mousedown', e => {
        e.preventDefault();
        selectPlace(place);
      });
      dropdown.appendChild(li);
    }

    dropdown.hidden = false;
  }

  function selectPlace(place: PlaceResult): void {
    input.value = place.name;
    hideDropdown();
    flyToPoint(place.lng, place.lat);
    setUserLocation(place.lng, place.lat);
  }

  function highlightItem(index: number): void {
    const items = dropdown.querySelectorAll<HTMLElement>('.location-search__item');
    items.forEach((el, i) => el.classList.toggle('highlighted', i === index));
    selectedIndex = index;
  }

  const doSearch = debounce(async (query: string) => {
    if (query.length < 2) { hideDropdown(); return; }
    const results = await searchPlaces(query, apiKey);
    showResults(results);
  }, 300);

  input.addEventListener('input', () => doSearch(input.value.trim()));

  input.addEventListener('keydown', e => {
    const items = currentResults;
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightItem(Math.min(selectedIndex + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightItem(Math.max(selectedIndex - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      selectPlace(items[selectedIndex]);
    } else if (e.key === 'Escape') {
      hideDropdown();
    }
  });

  input.addEventListener('blur', () => setTimeout(hideDropdown, 150));
  input.addEventListener('focus', () => {
    if (currentResults.length > 0) dropdown.hidden = false;
  });

  hideDropdown();
}
