import { albumsApi, artistsApi } from './artists';
import { atmosphereApi } from './atmosphere';
import { catalogApi } from './catalog';
import { discoverApi } from './discover';
import { libraryApi } from './library';
import { playlistsApi } from './playlists';

export { ApiError } from './client';

/**
 * The single entry point screens and hooks use for backend calls. Endpoints are
 * grouped by backend area in sibling files; this object only combines them.
 */
export const auraApi = {
  ...catalogApi,
  ...discoverApi,
  ...artistsApi,
  ...albumsApi,
  ...atmosphereApi,
  ...libraryApi,
  ...playlistsApi,
};
