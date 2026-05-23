// WIDGET-01 — Zonna home-screen widget.
//
// Two families:
//   .systemSmall  → race countdown (or today's session if no race)
//   .systemMedium → race countdown + today's session, side by side
//
// Reads a JSON state payload from the App Group container
// (group.app.zonna.ios) — written by the JS app via the SharedStore
// Capacitor plugin (lib/native/sharedStore.ts). The widget itself
// makes no network calls — all data is staged into UserDefaults by
// the main app and read here on every timeline tick.
//
// Timeline strategy:
//   • current entry: now
//   • next entry: next local midnight (when daysToRace + today's
//     session both change)
//   • after that: WidgetKit auto-reschedules when reactivated
//
// All colour values are resolved Warm Slate hex — lib/brand.ts BRAND.og.*
// values, duplicated here as Swift constants. CSS custom properties
// don't reach Swift; the canonical hex values are sealed in lib/brand.ts.

import WidgetKit
import SwiftUI

// MARK: - Colours (Warm Slate, mirrors lib/brand.ts BRAND.og)

private enum ZonnaColour {
    static let bg   = Color(red: 0xF3/255, green: 0xF0/255, blue: 0xEB/255)
    static let ink  = Color(red: 0x1A/255, green: 0x1A/255, blue: 0x1A/255)
    static let mute = Color(red: 0x8A/255, green: 0x85/255, blue: 0x7D/255)
    static let moss = Color(red: 0x6B/255, green: 0x8E/255, blue: 0x6B/255)
}

// MARK: - Data model — matches lib/widget/widgetState.ts

struct WidgetState: Codable {
    let raceName: String?
    let raceDate: String?        // ISO yyyy-MM-dd
    let daysToRace: Int?
    let todaySessionType: String?    // "easy" / "long" / "rest" / etc.
    let todaySessionLabel: String?
    let todayDistanceKm: Double?
    let todayDurationMins: Int?
    let updatedAt: String?       // ISO timestamp the JS app last wrote
}

extension WidgetState {
    /// Read the latest payload written by the main app to the App
    /// Group container. Returns nil when the user hasn't opened the
    /// app yet on this device, or when the payload is corrupted.
    static func load() -> WidgetState? {
        guard let defaults = UserDefaults(suiteName: "group.app.zonna.ios"),
              let raw = defaults.string(forKey: "zonna_widget_state"),
              let data = raw.data(using: .utf8) else {
            return nil
        }
        return try? JSONDecoder().decode(WidgetState.self, from: data)
    }
}

// MARK: - Timeline entry

struct ZonnaEntry: TimelineEntry {
    let date: Date
    let state: WidgetState?
}

// MARK: - Provider

struct ZonnaProvider: TimelineProvider {

    /// Placeholder shown in the widget gallery before any data exists.
    /// Kept deliberately bland so the gallery doesn't lie about content.
    func placeholder(in context: Context) -> ZonnaEntry {
        ZonnaEntry(date: Date(), state: nil)
    }

    /// Snapshot for the widget gallery + transient previews. Uses real
    /// data if available; falls back to the placeholder.
    func getSnapshot(in context: Context, completion: @escaping (ZonnaEntry) -> Void) {
        completion(ZonnaEntry(date: Date(), state: WidgetState.load()))
    }

    /// Build a two-entry timeline: now and next local midnight. iOS
    /// reschedules automatically after that — we don't need to project
    /// further into the future because both `daysToRace` and today's
    /// session change at midnight.
    func getTimeline(in context: Context, completion: @escaping (Timeline<ZonnaEntry>) -> Void) {
        let now      = Date()
        let calendar = Calendar.current
        let midnight = calendar.startOfDay(for: calendar.date(byAdding: .day, value: 1, to: now)!)
        let entries  = [
            ZonnaEntry(date: now,      state: WidgetState.load()),
            ZonnaEntry(date: midnight, state: WidgetState.load()),
        ]
        completion(Timeline(entries: entries, policy: .after(midnight)))
    }
}

// MARK: - Helpers

/// Map session_type strings to runner-facing short labels. Mirrors the
/// helper logic on the JS side (lib/session-types.ts → getSessionLabel)
/// but trimmed for widget legibility.
private func sessionTypeLabel(_ type: String?) -> String {
    switch type {
    case "easy", "run":              return "Easy"
    case "long":                     return "Long run"
    case "quality", "tempo":         return "Tempo"
    case "intervals", "hard":        return "Intervals"
    case "race":                     return "Race"
    case "recovery":                 return "Recovery"
    case "strength":                 return "Strength"
    case "cross-train":              return "Cross"
    case "rest":                     return "Rest day"
    case .none:                      return "—"
    case .some:                      return type!.capitalized
    }
}

/// Format the session's primary metric. Duration wins if set, distance
/// otherwise. Returns nil for rest days — caller decides what to render.
private func sessionMetric(state: WidgetState) -> String? {
    if state.todaySessionType == "rest" { return nil }
    if let mins = state.todayDurationMins, mins > 0 {
        if mins >= 60 && mins % 60 == 0 { return "\(mins / 60)h" }
        if mins >= 90 {
            return "\(mins / 60)h\(String(format: "%02d", mins % 60))"
        }
        return "\(mins)m"
    }
    if let km = state.todayDistanceKm, km > 0 {
        if km.truncatingRemainder(dividingBy: 1) == 0 {
            return "\(Int(km))km"
        }
        return String(format: "%.1fkm", km)
    }
    return nil
}

// MARK: - Views

struct ZonnaWidgetEntryView: View {
    var entry: ZonnaEntry

    @Environment(\.widgetFamily) var family: WidgetFamily

    var body: some View {
        switch family {
        case .systemMedium:
            mediumLayout
        default:
            smallLayout
        }
    }

    // ---- small (155×155 @1x) ----
    private var smallLayout: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("ZONNA")
                .font(.system(size: 10, weight: .heavy))
                .tracking(2)
                .foregroundColor(ZonnaColour.mute)

            Spacer(minLength: 0)

            if let s = entry.state, let days = s.daysToRace, days >= 0, let race = s.raceName {
                // Race countdown — the most distinctive small-widget surface.
                Text("\(days)")
                    .font(.system(size: 44, weight: .heavy))
                    .foregroundColor(ZonnaColour.ink)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
                Text("days to \(race)")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(ZonnaColour.mute)
                    .lineLimit(2)
            } else if let s = entry.state {
                // No race — fall back to today's session block.
                todayBlock(state: s, scale: .small)
            } else {
                Text("Open Zonna to load this week.")
                    .font(.system(size: 12, weight: .regular))
                    .foregroundColor(ZonnaColour.mute)
                    .multilineTextAlignment(.leading)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(ZonnaColour.bg)
    }

    // ---- medium (329×155 @1x) ----
    private var mediumLayout: some View {
        HStack(alignment: .top, spacing: 16) {
            // Left half — race countdown
            VStack(alignment: .leading, spacing: 4) {
                Text("ZONNA")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(ZonnaColour.mute)
                Spacer(minLength: 0)
                if let s = entry.state, let days = s.daysToRace, days >= 0, let race = s.raceName {
                    Text("\(days)")
                        .font(.system(size: 48, weight: .heavy))
                        .foregroundColor(ZonnaColour.ink)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text("days to \(race)")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(ZonnaColour.mute)
                        .lineLimit(2)
                } else {
                    Text("Hold the zone.")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(ZonnaColour.moss)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            // Divider — thin hairline matching --line at the widget scale
            Rectangle()
                .fill(ZonnaColour.ink.opacity(0.08))
                .frame(width: 1)

            // Right half — today's session
            VStack(alignment: .leading, spacing: 4) {
                Text("TODAY")
                    .font(.system(size: 10, weight: .heavy))
                    .tracking(2)
                    .foregroundColor(ZonnaColour.mute)
                Spacer(minLength: 0)
                if let s = entry.state {
                    todayBlock(state: s, scale: .medium)
                } else {
                    Text("Open Zonna to load this week.")
                        .font(.system(size: 12, weight: .regular))
                        .foregroundColor(ZonnaColour.mute)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(ZonnaColour.bg)
    }

    private enum LayoutScale { case small, medium }

    @ViewBuilder
    private func todayBlock(state s: WidgetState, scale: LayoutScale) -> some View {
        if s.todaySessionType == "rest" {
            Text("Rest day.")
                .font(.system(size: scale == .small ? 18 : 22, weight: .bold))
                .foregroundColor(ZonnaColour.ink)
            Text("Do nothing. It helps.")
                .font(.system(size: 11, weight: .regular))
                .foregroundColor(ZonnaColour.mute)
                .lineLimit(2)
        } else {
            Text(sessionTypeLabel(s.todaySessionType))
                .font(.system(size: scale == .small ? 18 : 22, weight: .bold))
                .foregroundColor(ZonnaColour.ink)
            if let metric = sessionMetric(state: s) {
                Text(metric)
                    .font(.system(size: scale == .small ? 22 : 26, weight: .heavy))
                    .foregroundColor(ZonnaColour.moss)
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Widget definition

@main
struct ZonnaWidget: Widget {
    let kind: String = "ZonnaWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ZonnaProvider()) { entry in
            ZonnaWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Zonna")
        .description("Race countdown and today's session.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}
