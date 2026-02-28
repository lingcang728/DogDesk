use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const DOG_NORMAL_WIDTH: f64 = 180.0;
const DOG_NORMAL_HEIGHT: f64 = 220.0;
const DOG_NORMAL_BOTTOM_MARGIN: i32 = 4;
const DOG_SPRITE_HEIGHT: i32 = 80;
const DOG_HEAD_TOP_OFFSET: i32 = 12;

// ─── Timer State ─────────────────────────────────────────────
struct TimerState {
    last_reset: Instant,
    interval_secs: u64,
    is_reminding: bool,
}

impl TimerState {
    fn new(interval_secs: u64) -> Self {
        Self {
            last_reset: Instant::now(),
            interval_secs,
            is_reminding: false,
        }
    }
}

// ─── Tauri Commands ──────────────────────────────────────────

/// Read clipboard text (used by the dog window when double-clicked)
#[tauri::command]
fn read_clipboard() -> String {
    match arboard::Clipboard::new() {
        Ok(mut clipboard) => clipboard.get_text().unwrap_or_default(),
        Err(_) => String::new(),
    }
}

/// Show translation window positioned above the dog
#[tauri::command]
fn translate_text(app: AppHandle, text: String) {
    show_translation(&app, &text);
}

#[tauri::command]
fn reposition_translation(app: AppHandle, settled: bool) {
    position_translation_window(&app, settled);
}

#[tauri::command]
fn hide_translation(app: AppHandle) {
    if let Some(win) = app.get_webview_window("translation") {
        let _ = win.hide();
    }
    if let Some(dog_win) = app.get_webview_window("dog") {
        let _ = dog_win.emit("translation-finished", ());
    }
}

#[tauri::command]
fn translation_ready(app: AppHandle) {
    if let Some(dog_win) = app.get_webview_window("dog") {
        let _ = dog_win.emit("translation-finished", ());
    }
}

#[tauri::command]
fn dismiss_reminder(state: tauri::State<'_, Arc<Mutex<TimerState>>>, app: AppHandle) {
    {
        let mut timer = state.lock().unwrap();
        timer.last_reset = Instant::now();
        timer.is_reminding = false;
    }
    reset_dog_window(&app);
}

#[tauri::command]
fn set_reminder_interval(state: tauri::State<'_, Arc<Mutex<TimerState>>>, minutes: u64) {
    let mut timer = state.lock().unwrap();
    timer.interval_secs = minutes * 60;
    timer.last_reset = Instant::now();
    timer.is_reminding = false;
}

// ─── Translation Helper ─────────────────────────────────────
fn clamp_i32(value: i32, min: i32, max: i32) -> i32 {
    if max < min {
        return min;
    }
    value.max(min).min(max)
}

fn position_translation_window(app: &AppHandle, settled: bool) {
    let Some(dog_win) = app.get_webview_window("dog") else {
        return;
    };
    let Some(trans_win) = app.get_webview_window("translation") else {
        return;
    };
    let Ok(dog_pos) = dog_win.outer_position() else {
        return;
    };

    let dog_size = dog_win.outer_size().ok();
    let trans_size = trans_win.outer_size().ok();

    let dog_w = dog_size
        .map(|s| s.width as i32)
        .unwrap_or(DOG_NORMAL_WIDTH as i32);
    let dog_h = dog_size
        .map(|s| s.height as i32)
        .unwrap_or(DOG_NORMAL_HEIGHT as i32);
    let trans_w = trans_size.map(|s| s.width as i32).unwrap_or(260);
    let trans_h = trans_size.map(|s| s.height as i32).unwrap_or(220);
    let margin = 8;
    let close_gap = 4;
    let final_gap = 10;

    let (screen_left, screen_top, screen_right, screen_bottom) =
        if let Ok(Some(monitor)) = dog_win.current_monitor() {
            let pos = monitor.position();
            let size = monitor.size();
            (
                pos.x,
                pos.y,
                pos.x + size.width as i32,
                pos.y + size.height as i32,
            )
        } else {
            // Fallback large bounds if monitor info is unavailable.
            (-20_000, -20_000, 20_000, 20_000)
        };

    let min_x = screen_left + margin;
    let min_y = screen_top + margin;
    let max_x = screen_right - trans_w - margin;
    let max_y = screen_bottom - trans_h - margin;

    let preferred_x = dog_pos.x + (dog_w - trans_w) / 2;
    // Dog sprite sits near the bottom edge in normal mode; anchor near head-top.
    let head_top_y =
        dog_pos.y + dog_h - DOG_NORMAL_BOTTOM_MARGIN - DOG_SPRITE_HEIGHT + DOG_HEAD_TOP_OFFSET;
    let effective_h = if settled {
        trans_h
    } else {
        ((trans_h as f32) * 0.62) as i32
    };
    let gap = if settled { final_gap } else { close_gap };
    let above_y = head_top_y - effective_h - gap;
    let below_y = dog_pos.y + dog_h + margin;

    let trans_x = clamp_i32(preferred_x, min_x, max_x);
    let preferred_y = if above_y < min_y { below_y } else { above_y };
    let trans_y = clamp_i32(preferred_y, min_y, max_y);

    let _ = trans_win.set_position(tauri::PhysicalPosition::new(trans_x, trans_y));
}

fn show_translation(app: &AppHandle, text: &str) {
    if let Some(dog_win) = app.get_webview_window("dog") {
        let _ = dog_win.emit("translation-started", ());
    }
    let Some(trans_win) = app.get_webview_window("translation") else {
        return;
    };

    // Loading phase: keep it a bit closer to dog head.
    position_translation_window(app, false);
    let _ = trans_win.show();
    let _ = trans_win.set_focus();
    let _ = trans_win.emit("trigger-translate", text);
}

/// Simulate Ctrl+C to copy current selection, then translate
fn shortcut_translate(app: &AppHandle) {
    // Simulate Ctrl+C to copy selected text
    #[cfg(target_os = "windows")]
    {
        use std::mem;
        use winapi::um::winuser::{
            SendInput, INPUT, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_CONTROL,
        };

        unsafe {
            let mut inputs: [INPUT; 4] = mem::zeroed();

            // Ctrl down
            inputs[0].type_ = INPUT_KEYBOARD;
            *inputs[0].u.ki_mut() = KEYBDINPUT {
                wVk: VK_CONTROL as u16,
                wScan: 0,
                dwFlags: 0,
                time: 0,
                dwExtraInfo: 0,
            };
            // C down
            inputs[1].type_ = INPUT_KEYBOARD;
            *inputs[1].u.ki_mut() = KEYBDINPUT {
                wVk: 0x43, // VK_C
                wScan: 0,
                dwFlags: 0,
                time: 0,
                dwExtraInfo: 0,
            };
            // C up
            inputs[2].type_ = INPUT_KEYBOARD;
            *inputs[2].u.ki_mut() = KEYBDINPUT {
                wVk: 0x43,
                wScan: 0,
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            };
            // Ctrl up
            inputs[3].type_ = INPUT_KEYBOARD;
            *inputs[3].u.ki_mut() = KEYBDINPUT {
                wVk: VK_CONTROL as u16,
                wScan: 0,
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            };

            SendInput(4, inputs.as_mut_ptr(), mem::size_of::<INPUT>() as i32);
        }

        // Wait for clipboard to update
        std::thread::sleep(Duration::from_millis(150));
    }

    // Read clipboard
    let text = match arboard::Clipboard::new() {
        Ok(mut clipboard) => clipboard.get_text().unwrap_or_default(),
        Err(_) => return,
    };
    let text = text.trim().to_string();
    if text.is_empty() {
        return;
    }
    show_translation(app, &text);
}

// ─── Window Helpers ──────────────────────────────────────────
fn position_dog_window(app: &AppHandle) {
    if let Some(dog_win) = app.get_webview_window("dog") {
        if let Ok(Some(monitor)) = dog_win.current_monitor() {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            let screen_w = size.width as f64 / scale;
            let screen_h = size.height as f64 / scale;
            let x = (screen_w - DOG_NORMAL_WIDTH) / 2.0;
            let y = (screen_h - DOG_NORMAL_HEIGHT) / 2.0;
            let _ = dog_win.set_position(tauri::LogicalPosition::new(x, y));
        }
    }
}

fn reset_dog_window(app: &AppHandle) {
    if let Some(dog_win) = app.get_webview_window("dog") {
        let _ = dog_win.set_size(tauri::LogicalSize::new(DOG_NORMAL_WIDTH, DOG_NORMAL_HEIGHT));
        position_dog_window(app);
        let _ = dog_win.emit("reminder-dismissed", ());
    }
}

fn launched_from_autostart() -> bool {
    std::env::args().any(|arg| arg == "--autostart")
}

fn hide_main_windows(app: &AppHandle) {
    if let Some(dog_win) = app.get_webview_window("dog") {
        let _ = dog_win.hide();
    }
    if let Some(trans_win) = app.get_webview_window("translation") {
        let _ = trans_win.hide();
    }
}

fn expand_dog_for_reminder(app: &AppHandle) {
    if let Some(dog_win) = app.get_webview_window("dog") {
        if let Ok(Some(monitor)) = dog_win.current_monitor() {
            let size = monitor.size();
            let scale = monitor.scale_factor();
            let screen_w = size.width as f64 / scale;
            let screen_h = size.height as f64 / scale;
            let _ = dog_win.set_size(tauri::LogicalSize::new(screen_w, 120.0));
            let _ = dog_win.set_position(tauri::LogicalPosition::new(0.0, screen_h - 120.0));
            let _ = dog_win.emit("break-reminder", ());
        }
    }
}

// ─── System Tray ─────────────────────────────────────────────
fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_hide = MenuItemBuilder::with_id("show_hide", "显示/隐藏小狗").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "退出 DogDesk").build(app)?;
    let menu = MenuBuilder::new(app).items(&[&show_hide, &quit]).build()?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("DogDesk 🐕")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_hide" => {
                if let Some(win) = app.get_webview_window("dog") {
                    if win.is_visible().unwrap_or(false) {
                        let _ = win.hide();
                    } else {
                        let _ = win.show();
                    }
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

// ─── App Entry ───────────────────────────────────────────────
pub fn run() {
    let timer_state = Arc::new(Mutex::new(TimerState::new(30 * 60)));

    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .manage(timer_state.clone())
        .setup(move |app| {
            let handle = app.handle().clone();
            let start_hidden = launched_from_autostart();
            position_dog_window(&handle);
            setup_tray(&handle)?;
            if start_hidden {
                hide_main_windows(&handle);
            }

            // Global shortcut: Ctrl+Shift+D → read clipboard → translate
            let shortcut_handle = handle.clone();
            handle.global_shortcut().on_shortcut(
                "ctrl+shift+d",
                move |_app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        shortcut_translate(&shortcut_handle);
                    }
                },
            )?;

            // Break reminder timer
            let timer_handle = handle.clone();
            let timer_ref = timer_state.clone();
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(10));
                let mut state = timer_ref.lock().unwrap();
                if !state.is_reminding
                    && state.last_reset.elapsed().as_secs() >= state.interval_secs
                {
                    state.is_reminding = true;
                    drop(state);
                    expand_dog_for_reminder(&timer_handle);
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_clipboard,
            translate_text,
            reposition_translation,
            hide_translation,
            translation_ready,
            dismiss_reminder,
            set_reminder_interval
        ])
        .run(tauri::generate_context!())
        .expect("error while running DogDesk");
}
