import { 
  Camera, 
  CameraSource, 
  CameraResultType
} from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import api from './api';

const MEDIA_KEY = 'offline_media';
const MAX_OFFLINE_MEDIA = 50;

export const CameraService = {
  name: 'CameraService',

  async checkPermission() {
    try {
      const permission = await Camera.requestPermission();
      return permission.camera === 'granted';
    } catch (error) {
      console.error('[CAMERA] Check permission error:', error);
      return false;
    }
  },

  async takePhoto(options = {}) {
    try {
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        console.log('[CAMERA] Permission denied');
        return null;
      }

      const image = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        quality: options.quality || 80,
        width: 1920,
        height: 1080,
        allowEditing: true,
        saveToGallery: true
      });

      if (image && image.webPath) {
        const mediaFile = {
          id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          path: image.webPath,
          dataUrl: image.webPath,
          type: 'photo',
          timestamp: Date.now(),
          synced: false,
          incident_id: options.incident_id
        };

        await this.saveMedia(mediaFile);
        console.log('[CAMERA] Photo taken:', mediaFile.id);
        return mediaFile;
      }

      return null;
    } catch (error) {
      console.error('[CAMERA] Take photo error:', error);
      return null;
    }
  },

  async takeMultiplePhotos(count = 3, incident_id) {
    const photos = [];
    
    for (let i = 0; i < count; i++) {
      const photo = await this.takePhoto({ incident_id });
      if (photo) {
        photos.push(photo);
      }
    }

    return photos;
  },

  async pickFromGallery(incident_id) {
    try {
      const hasPermission = await this.checkPermission();
      if (!hasPermission) {
        console.log('[CAMERA] Permission denied');
        return null;
      }

      const image = await Camera.getPhoto({
        resultType: CameraResultType.Uri,
        source: CameraSource.Photos,
        quality: 80,
        allowEditing: true
      });

      if (image && image.webPath) {
        const mediaFile = {
          id: `gallery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          path: image.webPath,
          dataUrl: image.webPath,
          type: 'photo',
          timestamp: Date.now(),
          synced: false,
          incident_id: incident_id
        };

        await this.saveMedia(mediaFile);
        console.log('[CAMERA] Photo picked:', mediaFile.id);
        return mediaFile;
      }

      return null;
    } catch (error) {
      console.error('[CAMERA] Pick from gallery error:', error);
      return null;
    }
  },

  async saveMedia(media) {
    try {
      const stored = await Preferences.get({ key: MEDIA_KEY });
      let mediaFiles = [];

      if (stored.value) {
        mediaFiles = JSON.parse(stored.value);
      }

      mediaFiles.push(media);

      if (mediaFiles.length > MAX_OFFLINE_MEDIA) {
        mediaFiles = mediaFiles.slice(-MAX_OFFLINE_MEDIA);
      }

      await Preferences.set({
        key: MEDIA_KEY,
        value: JSON.stringify(mediaFiles)
      });
    } catch (error) {
      console.error('[CAMERA] Save media error:', error);
    }
  },

  async getMedia(incident_id) {
    try {
      const stored = await Preferences.get({ key: MEDIA_KEY });
      if (stored.value) {
        let mediaFiles = JSON.parse(stored.value);
        
        if (incident_id) {
          mediaFiles = mediaFiles.filter(m => m.incident_id === incident_id);
        }

        return mediaFiles;
      }
    } catch (error) {
      console.error('[CAMERA] Get media error:', error);
    }
    return [];
  },

  async markAsSynced(mediaId) {
    try {
      const stored = await Preferences.get({ key: MEDIA_KEY });
      if (stored.value) {
        const mediaFiles = JSON.parse(stored.value);
        const updated = mediaFiles.map(m => 
          m.id === mediaId ? { ...m, synced: true } : m
        );
        
        await Preferences.set({
          key: MEDIA_KEY,
          value: JSON.stringify(updated)
        });
      }
    } catch (error) {
      console.error('[CAMERA] Mark as synced error:', error);
    }
  },

  async clearSynced() {
    try {
      const stored = await Preferences.get({ key: MEDIA_KEY });
      if (stored.value) {
        const mediaFiles = JSON.parse(stored.value);
        const unsynced = mediaFiles.filter(m => !m.synced);
        
        await Preferences.set({
          key: MEDIA_KEY,
          value: JSON.stringify(unsynced)
        });
      }
    } catch (error) {
      console.error('[CAMERA] Clear synced error:', error);
    }
  },

  async syncMedia(incident_id) {
    let synced = 0;

    try {
      const media = await this.getMedia(incident_id);
      const unsyncedMedia = media.filter(m => !m.synced);

      for (const m of unsyncedMedia) {
        try {
          const formData = new FormData();
          const response = await fetch(m.path);
          const blob = await response.blob();
          formData.append('file', blob, m.id + '.jpg');
          formData.append('incident_id', incident_id.toString());
          formData.append('type', m.type);

          await api.post('/reports/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });

          await this.markAsSynced(m.id);
          synced++;
        } catch (error) {
          console.error('[CAMERA] Sync media error:', error);
        }
      }

      console.log('[CAMERA] Synced:', synced);
      return synced;
    } catch (error) {
      console.error('[CAMERA] Sync error:', error);
      return synced;
    }
  },

  async deleteMedia(mediaId) {
    try {
      const stored = await Preferences.get({ key: MEDIA_KEY });
      if (stored.value) {
        const mediaFiles = JSON.parse(stored.value);
        const filtered = mediaFiles.filter(m => m.id !== mediaId);
        
        await Preferences.set({
          key: MEDIA_KEY,
          value: JSON.stringify(filtered)
        });
      }
    } catch (error) {
      console.error('[CAMERA] Delete media error:', error);
    }
  },

  async getPhotosCount() {
    const media = await this.getMedia();
    return media.filter(m => !m.synced).length;
  }
};

export default CameraService;