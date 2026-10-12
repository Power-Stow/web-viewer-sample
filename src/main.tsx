/*
 * SPDX-FileCopyrightText: Copyright (c) 2025 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: MIT
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
 * THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

import './index.css';
import {
    DirectConfig,
    StreamEvent,
    StreamType,
    EventAction,
    EventStatus,
} from '@nvidia/ov-web-rtc';
import ReactDOM from 'react-dom/client';
import OVAppStreamer from './react-component/OVAppStreamer';
import type { ViewProps } from './react-component/OVAppStreamConfig';

interface AppState {
    streamReady: boolean;
    streamFailed: boolean;
    errorMessage: string;
}

class StreamingApp {
    private reactRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;
    private state: AppState = {
        streamReady: false,
        streamFailed: false,
        errorMessage: 'FAILED TO CONNECT TO STREAM',
    };

    private updateUI() {
        const reactStreamRoot = document.getElementById('react-stream-root');
        const loadingStreamMessage = document.getElementById('loading-stream-message');
        const errorMessage = document.getElementById('error-message');
        if (!reactStreamRoot || !loadingStreamMessage || !errorMessage) {
            console.error('Missing DOM elements');
            return;
        }
        const setDisplay = (el, val) => {
            if (el) el.style.display = val;
        };
        if (this.state.streamFailed) {
            setDisplay(reactStreamRoot, 'none');
            setDisplay(loadingStreamMessage, 'none');
            setDisplay(errorMessage, 'flex');
            const errorText = document.getElementById('error-message-text');
            if (errorText) errorText.textContent = this.state.errorMessage;
        }
        else if (this.state.streamReady) {
            setDisplay(reactStreamRoot, 'block');
            setDisplay(loadingStreamMessage, 'none');
            setDisplay(errorMessage, 'none');
        }
        else {
            setDisplay(reactStreamRoot, 'none');
            setDisplay(loadingStreamMessage, 'flex');
            setDisplay(errorMessage, 'none');
        }
    }

    public async initialize() {
        this.renderReactStreamView();
        this.updateUI();
    }

    private renderReactStreamView() {
        const host = document.getElementById('react-stream-root');
        if (!host) {
            console.error('react-stream-root element not found');
            return;
        }
        if (!this.reactRoot) {
            this.reactRoot = ReactDOM.createRoot(host);
        }
        // Power Stow: the Kit host and the WebRTC signaling/media ports come from the environment at
        // runtime (set by `isaac --web-streaming` in auto_loader_sim), so several Isaac Sim instances
        // can be served from the same checkout. Defaults match the Isaac Sim streaming kit app.
        const streamServer = import.meta.env.VITE_STREAM_SERVER || '127.0.0.1';
        const streamConfig: DirectConfig = {
            videoElementId: 'remote-video',
            signalingServer: streamServer,
            signalingPort: Number(import.meta.env.VITE_STREAM_SIGNALING_PORT) || 49100,
            mediaServer: streamServer,
            mediaPort: Number(import.meta.env.VITE_STREAM_MEDIA_PORT) || 47998,
            forceWSS: false,
            width: 1920,
            height: 1080,
            fps: 60,
            onStart: (message: StreamEvent) => {
                console.log('Stream start callback:', message);
                if (message.action === EventAction.START) {
                    if (message.status === EventStatus.SUCCESS) {
                        console.log('Stream ready - updating UI');
                        this.state.streamReady = true;
                        this.state.streamFailed = false;
                        this.updateUI();
                    }
                    else if (message.status === EventStatus.ERROR) {
                        console.error('Stream start error:', message.info);
                        this.state.streamFailed = true;
                        this.state.errorMessage = `${message.info || 'Unknown error'}`;
                        this.updateUI();
                    }
                }
            },
            onCustomEvent: (message: any) => {
                console.log('Custom event:', message);
            },
            onStop: (message: StreamEvent) => {
                console.log('Stream stopped:', message);
                this.state.streamReady = false;
                this.state.streamFailed = false;
                this.updateUI();
            },
        };
        const viewProps: ViewProps = {
            stream: {
                streamSource: StreamType.DIRECT,
                streamConfig,
            },
        };
        this.reactRoot.render(<OVAppStreamer {...viewProps} />);
    }
}

// Keep browser shortcuts (fullscreen, reload, developer tools) on the browser instead of forwarding them to
// Kit. Same handling as the web viewer in NVIDIA's IsaacSim repository (tools/docker/web-viewer/Dockerfile).
const streamContainer = document.getElementById('stream-container');
if (streamContainer) {
    streamContainer.addEventListener(
        'keydown',
        (e: KeyboardEvent) => {
            if (e.key === 'F11' || e.code === 'F11') {
                e.preventDefault();
                e.stopPropagation();
                if (document.fullscreenElement) {
                    void document.exitFullscreen();
                }
                else {
                    void document.documentElement.requestFullscreen();
                }
                return;
            }
            if (e.key === 'F7') {
                e.preventDefault();
                return;
            }
            if (e.key === 'F5' || e.code === 'F5') {
                e.preventDefault();
                e.stopPropagation();
                window.location.reload();
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'r') {
                e.preventDefault();
                e.stopPropagation();
                window.location.reload();
                return;
            }
            if (e.key === 'F12' || e.code === 'F12') {
                e.stopPropagation();
                return;
            }
            if (
                (e.ctrlKey || e.metaKey) &&
                e.shiftKey &&
                ['i', 'j', 'c'].includes(e.key.toLowerCase())
            ) {
                e.stopPropagation();
                return;
            }
            if (e.metaKey && e.altKey && ['i', 'j', 'c'].includes(e.key.toLowerCase())) {
                e.stopPropagation();
                return;
            }
        },
        true
    );
}

// Initialize the application
const app = new StreamingApp();
void app.initialize();
