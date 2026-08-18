import { Component } from 'react'
import StartupErrorScreen from './StartupErrorScreen'
import { logStartupIssue } from '../lib/diagnostics'

// Class component is required here — React only supports error boundaries
// via getDerivedStateFromError/componentDidCatch, there's no hook
// equivalent. Catches synchronous render/lifecycle errors anywhere below it
// in the tree and shows a real fallback instead of leaving a blank page.
//
// Important limitation, by design of React's error boundary API: this does
// NOT catch errors thrown inside promises, async callbacks, or event
// handlers (e.g. a rejected fetch inside a useEffect) — only errors thrown
// during rendering. AuthContext and PetsContext handle their own
// async-failure cases separately for exactly this reason; this boundary is
// the second, independent layer of defense for a different failure class.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    logStartupIssue('render-error', error, errorInfo?.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <StartupErrorScreen
          message="The app hit an unexpected error and couldn't continue."
          detail={this.state.error.message}
          onRetry={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}
