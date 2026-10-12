/*
 * SPDX-FileCopyrightText: Copyright (c) 2024 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
 * SPDX-License-Identifier: LicenseRef-NvidiaProprietary
 *
 * NVIDIA CORPORATION, its affiliates and licensors retain all intellectual
 * property and proprietary rights in and to this material, related
 * documentation and any modifications thereto. Any use, reproduction,
 * disclosure or distribution of this material and related documentation
 * without an express license agreement from NVIDIA CORPORATION or
 * its affiliates is strictly prohibited.
 */
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { AppStreamer, StreamEvent, StreamProps, DirectConfig, GFNConfig, StreamType } from '@nvidia/omniverse-webrtc-streaming-library';
import StreamConfig from '../stream.config.json';
import './AppStream.css';

const stream_server_override = import.meta.env.VITE_STREAM_SERVER as string | undefined;
const stream_signaling_port_override = import.meta.env.VITE_STREAM_SIGNALING_PORT as string | undefined;
const stream_media_port_override = import.meta.env.VITE_STREAM_MEDIA_PORT as string | undefined;

const parse_port_override = (port_value: string | undefined): number | undefined => {
    if (port_value == null || port_value.trim() === '') {
        return undefined;
    }

    const parsed_value = Number.parseInt(port_value, 10);
    if (Number.isNaN(parsed_value)) {
        return undefined;
    }

    return parsed_value;
}

const resolve_local_stream_server = (): string => {
    if (stream_server_override != null && stream_server_override.trim() !== '') {
        return stream_server_override;
    }

    return StreamConfig.local.server;
}

const resolve_local_signaling_port = (): number => {
    return parse_port_override(stream_signaling_port_override) ?? StreamConfig.local.signalingPort;
}

const resolve_local_media_port = (): number | undefined => {
    return parse_port_override(stream_media_port_override) ?? StreamConfig.local.mediaPort;
}


interface AppStreamProps {
    sessionId: string
    backendUrl: string
    signalingserver: string
    signalingport: number
    mediaserver: string
    mediaport: number
    accessToken: string
    style?: React.CSSProperties;
    onStarted: () => void;
    onStreamFailed: () => void;
    onLoggedIn: (userId: string) => void;
    handleCustomEvent: (event: any) => void;
    onFocus: () => void;
    onBlur: () => void;
}

interface AppStreamState {
    streamReady: boolean;
    isConnecting: boolean;
}

export default class AppStream extends Component<AppStreamProps, AppStreamState> {
    private _requested: boolean;
    private _containerRef: React.RefObject<HTMLDivElement>;
    private _resizeDebounceTimer: ReturnType<typeof setTimeout> | null;

    static defaultProps = {
        style: {}
    };

    static propTypes = {
        onStarted: PropTypes.func.isRequired,
        handleCustomEvent: PropTypes.func.isRequired,
        style: PropTypes.object
    };

    constructor(props: AppStreamProps) {
        super(props);

        this._requested = false;
        this._containerRef = React.createRef<HTMLDivElement>();
        this._resizeDebounceTimer = null;
        this.state = {
            streamReady: false,
            isConnecting: true
        };
    }

    componentDidMount() {
        window.addEventListener('resize', this._onWindowResize);

        if (!this._requested) {
            this._requested = true;

            let streamProps: StreamProps;
            let streamConfig: DirectConfig | GFNConfig;
            let streamSource: StreamType.DIRECT | StreamType.GFN;

            if (StreamConfig.source === 'gfn') {
                    streamSource = StreamType.GFN;
                    streamConfig = {
                        //@ts-ignore
                        GFN             : GFN,
                        catalogClientId : StreamConfig.gfn.catalogClientId,
                        clientId        : StreamConfig.gfn.clientId,
                        cmsId           : StreamConfig.gfn.cmsId,
                        onUpdate        : (message: StreamEvent) => this._onUpdate(message),
                        onStart         : (message: StreamEvent) => this._onStart(message),
                        onCustomEvent   : (message: any) => this._onCustomEvent(message)
                    }
            }

            else if (StreamConfig.source === 'local') {
                const local_stream_server = resolve_local_stream_server();
                const local_signaling_port = resolve_local_signaling_port();
                const local_media_port = resolve_local_media_port();

                streamSource = StreamType.DIRECT;
                streamConfig = {
                    videoElementId: 'remote-video',
                    audioElementId: 'remote-audio',
                    // Kit's livestream server runs without bearer authentication (authenticateBearer = false), and the
                    // streaming library (5.18+) refuses to start with authenticate enabled but no access token.
                    authenticate: false,
                    maxReconnects: 20,
                    signalingServer: local_stream_server,
                    signalingPort: local_signaling_port,
                    mediaServer: local_stream_server,
                    ...(local_media_port != null && { mediaPort: local_media_port }),
                    nativeTouchEvents: true,
                    width: 1920,
                    height: 1080,
                    fps: 60,
                    onUpdate: (message: StreamEvent) => this._onUpdate(message),
                    onStart: (message: StreamEvent) => this._onStart(message),
                    onCustomEvent: (message: any) => this._onCustomEvent(message),
                    onStop: (message: StreamEvent) => { console.log(message) },
                    onTerminate: (message: StreamEvent) => { console.log(message) }
                };
            }
                
            else if (StreamConfig.source === 'stream') {
                streamSource =  StreamType.DIRECT;
                streamConfig = {
                    signalingServer: this.props.signalingserver,
                    signalingPort: this.props.signalingport,
                    mediaServer: this.props.mediaserver,
                    mediaPort: this.props.mediaport,
                    backendUrl: this.props.backendUrl,
                    sessionId: this.props.sessionId,
                    autoLaunch: true,
                    cursor: 'free',
                    mic: false,
                    videoElementId: 'remote-video',
                    audioElementId: 'remote-audio',
                    authenticate: false,
                    maxReconnects: 20,
                    nativeTouchEvents: true,
                    width: 1920,
                    height: 1080,
                    fps: 60,
                    onUpdate: (message: StreamEvent) => this._onUpdate(message),
                    onStart: (message: StreamEvent) => this._onStart(message),
                    onCustomEvent: (message: any) => this._onCustomEvent(message),
                    onStop: (message: StreamEvent) => { console.log(message) },
                    onTerminate: (message: StreamEvent) => { console.log(message) },
                };
            }
                
            else {
                console.error(`Unknown stream source: ${StreamConfig.source}`);
                return
            }

            try {
                streamProps = {streamConfig, streamSource}
                AppStreamer.connect(streamProps)
                .then((result: StreamEvent) => {
                    console.info(result);
                })
                .catch((error: StreamEvent) => {
                    console.error(error);
                    this.setState({ isConnecting: false });
                });
            }
            catch (error) {
                console.error(error);
                this.setState({ isConnecting: false });
            }
        }
    }

    componentDidUpdate(_prevProps: AppStreamProps, prevState: AppStreamState, _snapshot: any) {
        if (prevState.streamReady === false && this.state.streamReady === true) {
            const player = document.getElementById("gfn-stream-player-video") as HTMLVideoElement;
            if (player) {
                player.tabIndex = -1;
                player.playsInline = true;
                player.muted = true;
                player.play();
            }

            this._scheduleResolutionSync();
        }
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this._onWindowResize);
        if (this._resizeDebounceTimer) {
            clearTimeout(this._resizeDebounceTimer);
            this._resizeDebounceTimer = null;
        }
    }

    static sendMessage(message: any) {
        AppStreamer.sendMessage(message);
    }

    static stop() {
        AppStreamer.stop();
        (AppStreamer as any)._stream = null; // Accessing a private member
    }

    _onStart(message: any) {
        if (message.action === 'start' && message.status === 'success' && !this.state.streamReady) {
            console.info('streamReady');
            this.setState({ streamReady: true, isConnecting: false });
            this.props.onStarted();
        }

        if (message.status === "error" && StreamConfig.source === "stream")
        {
            console.log(message.info);
            alert(message.info);
            this.setState({ isConnecting: false });
            this.props.onStreamFailed();
            return;
        }
    }

    _onUpdate(message: any) {
        try {
            if (message.action === 'authUser' && message.status === 'success') {
                this.props.onLoggedIn(message.info);
            }
        } catch (error) {
            console.error(message);
        }
    }

    _onCustomEvent(message: any) {
        this.props.handleCustomEvent(message);
    }

    _onStop(message: any) {
        console.info('Stream stopped', message);
    }

    _onTerminate(message: any) {
        console.info('Stream terminated', message);
    }

    _onWindowResize = () => {
        if (!this.state.streamReady) {
            return;
        }
        this._scheduleResolutionSync();
    }

    _scheduleResolutionSync = () => {
        if (this._resizeDebounceTimer) {
            clearTimeout(this._resizeDebounceTimer);
        }

        this._resizeDebounceTimer = setTimeout(() => {
            this._sendResolutionSync();
        }, 200);
    }

    _getResolutionFromContainer = (): { width: number; height: number } | null => {
        const container = this._containerRef.current;
        if (!container) {
            return null;
        }

        const width = Math.max(2, Math.floor(container.clientWidth));
        const height = Math.max(2, Math.floor(container.clientHeight));

        return {
            width: width % 2 === 0 ? width : width - 1,
            height: height % 2 === 0 ? height : height - 1,
        };
    }

    _sendResolutionSync = () => {
        if (!this.state.streamReady || StreamConfig.source === 'gfn') {
            return;
        }

        const targetResolution = this._getResolutionFromContainer();
        if (!targetResolution) {
            return;
        }

        const message = {
            event_type: 'changeResolutionRequest',
            payload: {
                width: targetResolution.width,
                height: targetResolution.height,
            },
        };

        AppStream.sendMessage(JSON.stringify(message));
    }

    render() {
        const source = StreamConfig.source;

        if (source === 'gfn') {
            return (
                <div
                    ref={this._containerRef}
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        ...this.props.style
                    }}
                >
                    {this.state.isConnecting &&
                        <div className="stream-loading-overlay">
                            <div className="loading-indicator-label">
                                Connecting to stream...
                                <div className="spinner-border" role="status" style={{ marginTop: 10 }} />
                            </div>
                        </div>
                    }
                    <div
                        id="view"
                        style={{
                            backgroundColor: '#242424',
                            display: 'flex', justifyContent: 'space-between',
                            height: "100%",
                            width: "100%",
                        }}
                    />
                </div>
            );
        } else if (source === 'local' || source === 'stream') {
            return (
                <div
                    ref={this._containerRef}
                    style={{
                        position: 'relative',
                        width: '100%',
                        height: '100%',
                        ...this.props.style
                    }}
                >
                    {this.state.isConnecting &&
                        <div className="stream-loading-overlay">
                            <div className="loading-indicator-label">
                                Connecting to stream...
                                <div className="spinner-border" role="status" style={{ marginTop: 10 }} />
                            </div>
                        </div>
                    }
                    <div
                        key={'stream-canvas'}
                        id={'main-div'}
                        style={{
                            backgroundColor: '#242424',
                            visibility: this.state.streamReady ? 'visible' : 'hidden',
                        }}
                    >
                        <video
                            key={'video-canvas'}
                            id={'remote-video'}
                            style={{
                                left: 0,
                                top: 0,
                                width: '100%',
                                height: '100%',
                            }}
                            tabIndex={-1}
                            playsInline muted
                            autoPlay
                        />
                        <audio id="remote-audio" muted></audio>
                        <h3 style={{ visibility: 'hidden' }} id="message-display">...</h3>
                    </div>
                </div>
            );
        }

        return null;
    }
}
