
export interface AudioMarker {
  id: string;
  position: number; // in seconds
  type: 'start' | 'end';
}

export interface AudioFile {
  name: string;
  url: string;
  path: string;
  size: string;
  type: string;
  lastModified: string;
}
