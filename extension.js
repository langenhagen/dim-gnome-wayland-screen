/*
 * Dim GNOME Wayland Screen
 *
 * Software dimming via transparent black overlay over the shell's UI
 * group. Workaround for displays where intel_backlight sysfs accepts
 * writes but hardware brightness never changes (mini LED panels where
 * DPCD AUX backlight init fails).
 *
 * Polls /sys/class/backlight/intel_backlight/brightness every 1s,
 * computes alpha = (1.0 - ratio) * 255, paints a black Cogl.Color overlay
 * with that alpha. The brightness slider and F5/F6 still write to sysfs
 * normally — this extension mirrors them visually.
 *
 * PITFALLS / API CHURN:
 * - Clutter.Color was removed in GNOME 50 (deprecated since 47).
 *   Cogl.Color with direct struct fields is the current replacement.
 * - Mutter typelibs are versioned (Cogl-18, Clutter-18 on GNOME 50).
 *   "gi://Cogl" works because Clutter loads Cogl as a dependency first.
 *   Expect import paths to keep changing every release.
 * - 1 s poll interval = slightly sluggish slider response.
 * - Software overlay does not control the backlight directly.
 *   The goal is eye comfort, not power savings.
 */

import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import GLib from 'gi://GLib';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

const BACKLIGHT_PATH = '/sys/class/backlight/intel_backlight';
const POLL_INTERVAL_SECS = 1;

export default class DimScreenExtension extends Extension {
    _overlay = null;
    _pollId = 0;
    _sizeChangedIdW = 0;
    _sizeChangedIdH = 0;
    _currentBrightness = -1;
    _maxBrightness = -1;

    // Read a sysfs file, return trimmed string or null
    _readFile(path) {
        try {
            let [success, contents] = GLib.file_get_contents(path);
            if (success) {
                let decoder = new TextDecoder('utf-8');
                return decoder.decode(contents).trim();
            }
        } catch (e) {
            console.warn(`[DimScreen] Error reading ${path}: ${e}`);
        }
        return null;
    }

    // Poll brightness sysfs, compute overlay alpha from ratio
    _updateOverlay() {
        let valStr = this._readFile(`${BACKLIGHT_PATH}/brightness`);
        let maxStr = this._readFile(`${BACKLIGHT_PATH}/max_brightness`);
        if (valStr === null || maxStr === null) return;

        let val = parseInt(valStr, 10);
        let max = parseInt(maxStr, 10);
        if (isNaN(val) || isNaN(max) || max === 0) return;

        if (val === this._currentBrightness && max === this._maxBrightness) return;
        this._currentBrightness = val;
        this._maxBrightness = max;

        let ratio = val / max;
        let alpha = Math.round((1.0 - ratio) * 255);
        alpha = Math.max(0, Math.min(255, alpha));

        let color = new Cogl.Color();
        color.red = 0;
        color.green = 0;
        color.blue = 0;
        color.alpha = alpha;
        this._overlay.set_background_color(color);
    }

    _poll() {
        if (!this._overlay) return GLib.SOURCE_REMOVE;
        this._updateOverlay();
        return GLib.SOURCE_CONTINUE;
    }

    // Keep overlay covering the whole stage on resize / monitor change
    _resizeOverlay() {
        if (!this._overlay) return;
        this._overlay.set_size(global.stage.width, global.stage.height);
    }

    // Create black overlay, attach to shell UI group, start polling sysfs
    enable() {
        this._overlay = new Clutter.Actor({
            reactive: false,
            x: 0, y: 0,
        });
        this._resizeOverlay();
        Main.uiGroup.add_child(this._overlay);

        this._sizeChangedIdW = global.stage.connect('notify::width', this._resizeOverlay.bind(this));
        this._sizeChangedIdH = global.stage.connect('notify::height', this._resizeOverlay.bind(this));

        this._updateOverlay();
        this._pollId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, POLL_INTERVAL_SECS, this._poll.bind(this));
    }

    // Stop polling, destroy overlay, reset state
    disable() {
        if (this._pollId > 0) {
            GLib.source_remove(this._pollId);
            this._pollId = 0;
        }
        if (this._sizeChangedIdW > 0) {
            global.stage.disconnect(this._sizeChangedIdW);
            this._sizeChangedIdW = 0;
        }
        if (this._sizeChangedIdH > 0) {
            global.stage.disconnect(this._sizeChangedIdH);
            this._sizeChangedIdH = 0;
        }
        if (this._overlay) {
            this._overlay.destroy();
            this._overlay = null;
        }
        this._currentBrightness = -1;
        this._maxBrightness = -1;
    }
}
