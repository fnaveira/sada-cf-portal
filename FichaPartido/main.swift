import Cocoa
import WebKit

let app = NSApplication.shared
app.setActivationPolicy(.regular)

final class AppDelegate: NSObject, NSApplicationDelegate {
    var window: NSWindow!
    private var didComplete = false

    func applicationDidFinishLaunching(_ notification: Notification) {
        let rect = NSRect(x: 0, y: 0, width: 1000, height: 780)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Ficha del Partido — Portazgo S.D."
        window.center()
        window.minSize = NSSize(width: 640, height: 480)

        let webView = WKWebView()
        window.contentView = webView

        guard let url = Bundle.main.url(forResource: "index", withExtension: "html") else {
            window.contentView = NSTextField(labelWithString: "Falta index.html en Resources")
            window.makeKeyAndOrderFront(nil)
            return
        }

        fetchLive { [weak self] liveJson in
            guard let self = self else { return }
            DispatchQueue.main.async {
                var html = (try? String(contentsOf: url, encoding: .utf8)) ?? "Error leyendo index.html"
                if let json = liveJson {
                    html = html.replacingOccurrences(of: "/*__LIVE__*/null", with: json)
                }
                webView.loadHTMLString(html, baseURL: url.deletingLastPathComponent())
                self.window.makeKeyAndOrderFront(nil)
                app.activate(ignoringOtherApps: true)
            }
        }

        window.makeKeyAndOrderFront(nil)
        app.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    private func fetchLive(completion: @escaping (String?) -> Void) {
        let finish: (String?) -> Void = { [weak self] value in
            DispatchQueue.main.async {
                guard let self = self, !self.didComplete else { return }
                self.didComplete = true
                completion(value)
            }
        }
        guard let url = URL(string: "https://sada-cf-portal.onrender.com/api/init") else {
            finish(nil); return
        }
        let task = URLSession.shared.dataTask(with: url) { data, _, _ in
            defer {
                DispatchQueue.global().asyncAfter(deadline: .now() + 10) { finish(nil) }
            }
            guard let data = data,
                  let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                finish(nil); return
            }
            var slim: [String: Any] = [:]
            slim["players"] = obj["players"] ?? []
            slim["convocatoria"] = obj["convocatoria"] ?? []
            slim["pendingConfirm"] = obj["pendingConfirm"] ?? []
            slim["matches"] = obj["matches"] ?? []
            if let json = try? JSONSerialization.data(withJSONObject: slim),
               let s = String(data: json, encoding: .utf8) {
                finish(s)
            } else {
                finish(nil)
            }
        }
        task.resume()
        DispatchQueue.global().asyncAfter(deadline: .now() + 10) { finish(nil) }
    }
}

let delegate = AppDelegate()
app.delegate = delegate
app.run()
