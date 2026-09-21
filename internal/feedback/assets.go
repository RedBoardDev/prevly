package feedback

import _ "embed"

// scriptJS is the widget bundle built from widget/ and committed under assets/.
//
//go:embed assets/feedback.js
var scriptJS []byte
