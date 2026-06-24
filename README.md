# Dim GNOME Wayland Screen

Software overlay dimming for displays where hardware backlight control
does not work - mini LED panels, DPCD backlight init failures, etc.

## Prerequisites

- GNOME 50+ on Wayland
- `intel_backlight` sysfs at `/sys/class/backlight/intel_backlight/`
- `gnome-extensions` CLI

## Installation

```bash
git clone https://github.com/langenhagen/dim-gnome-wayland-screen.git
cd dim-gnome-wayland-screen
./install.sh
```

This creates a symlink in `~/.local/share/gnome-shell/extensions/`.
Log out and back in, then enable:

```bash
gnome-extensions enable dim-gnome-wayland-screen@user
```

## Uninstallation

```bash
rm -rf ~/.local/share/gnome-shell/extensions/dim-gnome-wayland-screen@user
```

Log out and back in. Or just disable without removing:

```bash
gnome-extensions disable dim-gnome-wayland-screen@user
```

## Usage

Adjust the brightness slider or press F5/F6 - the overlay dims
automatically. Disable the extension to remove the overlay and restore
full brightness.

## How It Works

1. Reads `/sys/class/backlight/intel_backlight/brightness` every second.
2. Computes overlay alpha = `(1.0 - brightness / max_brightness) * 255`.
3. Paints a black `ClutterActor` with that alpha on top of the shell's
   UI group. The overlay is non-reactive (clicks and touch pass through).

The brightness slider and hotkeys still write to `intel_backlight`
normally - the extension just mirrors the value visually.

## Known Pitfalls

- **GNOME / Mutter API churn.** `Clutter.Color` was removed in GNOME 50
  (deprecated since 47). `Cogl.Color` with direct struct fields is the
  current replacement. Versioned typelibs (`Cogl-18`, `Clutter-18`)
  change every release. Expect import paths to break.
- **1 s poll interval** = slightly laggy slider. Change
  `POLL_INTERVAL_SECS` in `extension.js` if needed.
- **Does not control the backlight.** The overlay is a software trick -
  it paints black on top of the desktop. `intel_backlight` sysfs writes
  are accepted but the hardware ignores them (DPCD AUX backlight init
  fails). The extension masks the symptom, it does not fix the driver.

## Troubleshooting

Check extension state:

```bash
gnome-extensions info dim-gnome-wayland-screen@user
```

Should show `State: ACTIVE`. If `ERROR`, check the logs:

```bash
journalctl -n 30 -o cat /usr/bin/gnome-shell | grep dim
```

## License

See [LICENSE](LICENSE) file.
