import { Component, ReactNode } from 'react'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = { hasError: false, error: null }
    }

    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error }
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[SpudTile] Render crash:', error, info.componentStack)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    background: '#1a1a2e',
                    color: '#fff',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'system-ui, sans-serif',
                    padding: '2rem',
                }}>
                    <h1 style={{ color: '#f97316', fontSize: '1.5rem', marginBottom: '1rem' }}>
                        SpudTile crashed
                    </h1>
                    <pre style={{
                        background: '#12121f',
                        padding: '1rem',
                        borderRadius: '8px',
                        maxWidth: '80%',
                        overflow: 'auto',
                        fontSize: '0.85rem',
                        color: '#ff6b6b',
                    }}>
                        {this.state.error?.message}
                    </pre>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1.5rem',
                            background: '#f97316',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                        }}
                    >
                        Try Again
                    </button>
                </div>
            )
        }

        return this.props.children
    }
}
