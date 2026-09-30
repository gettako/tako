package handlers

import (
	"net/http"

	"github.com/go-chi/chi/v5"
)

// GetServiceMetrics handles GET /api/services/{id}/metrics.
func (h *Handler) GetServiceMetrics(w http.ResponseWriter, r *http.Request) {
	serviceID := chi.URLParam(r, "id")
	if serviceID == "" {
		sendError(w, http.StatusBadRequest, "service ID is required")
		return
	}

	// Verify service exists
	var exists bool
	err := h.db.QueryRowContext(r.Context(), "SELECT 1 FROM services WHERE id = ?", serviceID).Scan(&exists)
	if err != nil || !exists {
		sendError(w, http.StatusNotFound, "service not found")
		return
	}

	if h.metricsManager == nil {
		sendError(w, http.StatusInternalServerError, "metrics manager not initialized")
		return
	}

	timeRange := r.URL.Query().Get("range")
	metrics, err := h.metricsManager.GetMetrics(r.Context(), serviceID, timeRange)
	if err != nil {
		sendError(w, http.StatusInternalServerError, "failed to retrieve metrics: "+err.Error())
		return
	}

	sendJSON(w, http.StatusOK, metrics)
}
