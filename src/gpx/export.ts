import type { LineString } from 'geojson';
import { lngLatToGpxPt } from '../util/coord';
import { isoNow, dateStamp, slugify } from '../util/format';
import { showToast } from '../ui/toast';

const PACE_SEC_PER_M = (7 * 60) / 1000; // 7 min/km → sec/m

export function buildGpx(
  line: LineString,
  name: string,
  withTimestamp: boolean
): string {
  const coords = line.coordinates as [number, number][];
  const now = new Date();
  let elapsed = 0;

  const trkpts = coords
    .map(c => {
      const pt = lngLatToGpxPt([c[0], c[1]]);
      let timeEl = '';
      if (withTimestamp) {
        const ts = new Date(now.getTime() + elapsed * 1000).toISOString();
        timeEl = `\n        <time>${ts}</time>`;
        if (coords.indexOf(c) < coords.length - 1) {
          const next = coords[coords.indexOf(c) + 1];
          const dx = next[0] - c[0];
          const dy = next[1] - c[1];
          const approxM = Math.sqrt(dx * dx + dy * dy) * 111000;
          elapsed += approxM * PACE_SEC_PER_M;
        }
      }
      return `      <trkpt lat="${pt.lat.toFixed(6)}" lon="${pt.lon.toFixed(6)}">${timeEl}\n      </trkpt>`;
    })
    .join('\n');

  const displayName = name || `아트런 ${dateStamp()}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ArtRun"
     xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(displayName)}</name>
    <time>${isoNow()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(displayName)}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export async function triggerGpxDownload(
  line: LineString,
  name: string,
  withTimestamp: boolean
): Promise<void> {
  const content = buildGpx(line, name, withTimestamp);
  const blob = new Blob([content], { type: 'application/gpx+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const displayName = name || `artrun_${dateStamp()}`;
  const filename = `${slugify(displayName) || 'artrun'}_${dateStamp()}.gpx`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 1000);

  showToast(`${filename} 저장됨`, 'success');
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
