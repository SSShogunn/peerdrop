package main

import "context"

// App has no bound methods — the desktop shell is a pure webview wrapper
// around client/, same as the Tauri build it replaces. Desktop detection in
// the frontend uses window.runtime, which Wails injects automatically.
type App struct {
	ctx context.Context
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}
