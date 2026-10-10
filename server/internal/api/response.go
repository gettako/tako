package api

import (
	"encoding/json"
	"net/http"
)

// RespondJSON writes a standardized JSON response with status code.
func RespondJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		_ = json.NewEncoder(w).Encode(data)
	}
}

// RespondError writes a standardized error JSON payload {"error": message}.
func RespondError(w http.ResponseWriter, status int, message string) {
	RespondJSON(w, status, map[string]string{
		"error": message,
	})
}

// RespondNoContent writes a 204 No Content status header.
func RespondNoContent(w http.ResponseWriter) {
	w.WriteHeader(http.StatusNoContent)
}

// DecodeJSON decodes a request body into the target pointer.
func DecodeJSON(r *http.Request, target any) error {
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(target)
}
