/**
 * Gets or creates a dedicated modal root container element.
 * This is safer than appending directly to document.body as it:
 * - Prevents conflicts with other libraries
 * - Makes it easier to manage and debug modals
 * - Allows for centralized styling if needed
 */
export const getModalRoot = (): HTMLElement | null => {
  if (typeof document === "undefined") {
    return null;
  }

  let modalRoot = document.getElementById("modal-root");

  if (!modalRoot) {
    modalRoot = document.createElement("div");
    modalRoot.id = "modal-root";
    document.body.appendChild(modalRoot);
  }

  return modalRoot;
};
