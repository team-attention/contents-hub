/**
 * Style constants for Selector Picker UI
 * All styles are contained within Shadow DOM for isolation
 */

export const PICKER_STYLES = `
  /* Reset */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* ============================================
   * Highlight Overlay
   * ============================================ */
  .highlight-overlay {
    position: fixed;
    pointer-events: none;
    border: 2px dashed #3b82f6;
    background: rgba(59, 130, 246, 0.1);
    z-index: 2147483646;
    transition: all 0.1s ease-out;
    border-radius: 4px;
  }

  .highlight-overlay.selected {
    border: 2px solid #3b82f6;
    background: rgba(59, 130, 246, 0.15);
  }

  /* ============================================
   * Top Banner (Selecting Mode)
   * ============================================ */
  .picker-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 48px;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 2147483647;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  }

  .banner-icon {
    font-size: 18px;
  }

  .banner-text {
    color: white;
  }

  .banner-cancel {
    position: absolute;
    right: 16px;
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    padding: 6px 12px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    transition: background 0.15s ease;
  }

  .banner-cancel:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  /* ============================================
   * Confirmation Panel
   * ============================================ */
  .confirmation-panel {
    position: fixed;
    bottom: 24px;
    right: 24px;
    width: 320px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    z-index: 2147483647;
    overflow: hidden;
    animation: slideIn 0.2s ease-out;
  }

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .panel-header {
    padding: 16px;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-title {
    font-weight: 600;
    font-size: 16px;
    color: #111827;
  }

  .panel-close {
    background: none;
    border: none;
    font-size: 20px;
    color: #9ca3af;
    cursor: pointer;
    padding: 4px;
    line-height: 1;
    border-radius: 4px;
    transition: all 0.15s ease;
  }

  .panel-close:hover {
    color: #6b7280;
    background: #f3f4f6;
  }

  .panel-body {
    padding: 16px;
  }

  .selector-preview {
    margin-bottom: 16px;
  }

  .selector-label {
    display: block;
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 6px;
    font-weight: 500;
  }

  .selector-text {
    display: block;
    background: #f3f4f6;
    padding: 10px 12px;
    border-radius: 6px;
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 12px;
    color: #374151;
    word-break: break-all;
    line-height: 1.4;
    max-height: 80px;
    overflow-y: auto;
  }

  /* ============================================
   * Result Area
   * ============================================ */
  .result-area {
    min-height: 44px;
    display: flex;
    align-items: center;
    padding: 12px;
    background: #f9fafb;
    border-radius: 8px;
  }

  .loading, .success, .error {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    width: 100%;
  }

  .loading {
    color: #6b7280;
  }

  .success {
    color: #059669;
  }

  .error {
    color: #dc2626;
  }

  .result-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  .result-text {
    flex: 1;
  }

  /* Spinner */
  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid #e5e7eb;
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* ============================================
   * Panel Footer
   * ============================================ */
  .panel-footer {
    padding: 12px 16px;
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
  }

  .btn-cancel {
    background: white;
    border: 1px solid #d1d5db;
    color: #374151;
  }

  .btn-cancel:hover {
    background: #f9fafb;
    border-color: #9ca3af;
  }

  .btn-reselect {
    background: #f3f4f6;
    color: #374151;
  }

  .btn-reselect:hover {
    background: #e5e7eb;
  }

  .btn-confirm {
    background: #3b82f6;
    color: white;
  }

  .btn-confirm:hover:not(:disabled) {
    background: #2563eb;
  }

  .btn-confirm:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  /* ============================================
   * Success Toast (after completion)
   * ============================================ */
  .success-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 16px 20px;
    background: #059669;
    color: white;
    border-radius: 10px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 10px;
    animation: slideIn 0.2s ease-out;
  }

  .success-toast .icon {
    font-size: 18px;
  }
`;
