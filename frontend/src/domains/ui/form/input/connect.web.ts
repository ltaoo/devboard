import { InputCore } from "./index";

export function connect(store: InputCore<string>, $input: HTMLInputElement) {
  store.focus = () => {
    store.setFocus();
    $input.focus();
  };
  store.blur = () => {
    store.setBlur();
    $input.blur();
  };
  $input.addEventListener("focus", () => {
    // console.log('[DOMAIN]ui/form/input - $input.addEventListener("focus');
    store.handleFocus();
  });
  $input.addEventListener("blur", () => {
    store.handleBlur();
  });
}
