using System;
using System.Reflection;
using UnityEngine;

namespace ScanMaster.UnitySimulation
{
    internal static class ScanMasterInput
    {
        private static bool legacyInputAvailable = true;
        private static Type keyboardType;
        private static Type mouseType;
        private static PropertyInfo keyboardCurrentProperty;
        private static PropertyInfo mouseCurrentProperty;

        public static bool GetKeyDown(KeyCode key)
        {
            if (legacyInputAvailable)
            {
                try
                {
                    return Input.GetKeyDown(key);
                }
                catch (InvalidOperationException)
                {
                    legacyInputAvailable = false;
                }
            }

            return GetNewInputKey(key);
        }

        public static bool GetMouseButton(int button)
        {
            if (legacyInputAvailable)
            {
                try
                {
                    return Input.GetMouseButton(button);
                }
                catch (InvalidOperationException)
                {
                    legacyInputAvailable = false;
                }
            }

            return GetNewMouseButton(button);
        }

        public static Vector2 GetMouseDelta()
        {
            if (legacyInputAvailable)
            {
                try
                {
                    return new Vector2(Input.GetAxis("Mouse X"), Input.GetAxis("Mouse Y"));
                }
                catch (InvalidOperationException)
                {
                    legacyInputAvailable = false;
                }
            }

            // Input System mouse delta is in pixels. Scale it to feel close to the legacy axes.
            return ReadNewMouseVector("delta") * 0.05f;
        }

        public static float GetScrollY()
        {
            if (legacyInputAvailable)
            {
                try
                {
                    return Input.mouseScrollDelta.y;
                }
                catch (InvalidOperationException)
                {
                    legacyInputAvailable = false;
                }
            }

            var scroll = ReadNewMouseVector("scroll").y;
            return Mathf.Abs(scroll) > 10f ? scroll / 120f : scroll;
        }

        private static bool GetNewInputKey(KeyCode key)
        {
            var propertyName = KeyCodeToInputSystemProperty(key);
            if (string.IsNullOrEmpty(propertyName))
            {
                return false;
            }

            var keyboard = GetCurrentKeyboard();
            return keyboard != null && ReadButtonProperty(keyboard, propertyName, "wasPressedThisFrame");
        }

        private static bool GetNewMouseButton(int button)
        {
            var propertyName = button == 1 ? "rightButton" : button == 0 ? "leftButton" : button == 2 ? "middleButton" : null;
            if (string.IsNullOrEmpty(propertyName))
            {
                return false;
            }

            var mouse = GetCurrentMouse();
            return mouse != null && ReadButtonProperty(mouse, propertyName, "isPressed");
        }

        private static Vector2 ReadNewMouseVector(string propertyName)
        {
            var mouse = GetCurrentMouse();
            if (mouse == null)
            {
                return Vector2.zero;
            }

            var control = mouse.GetType().GetProperty(propertyName, BindingFlags.Instance | BindingFlags.Public)?.GetValue(mouse);
            if (control == null)
            {
                return Vector2.zero;
            }

            var value = control.GetType().GetMethod("ReadValue", BindingFlags.Instance | BindingFlags.Public, null, Type.EmptyTypes, null)?.Invoke(control, null);
            return value is Vector2 vector ? vector : Vector2.zero;
        }

        private static bool ReadButtonProperty(object device, string controlPropertyName, string statePropertyName)
        {
            var control = device.GetType().GetProperty(controlPropertyName, BindingFlags.Instance | BindingFlags.Public)?.GetValue(device);
            if (control == null)
            {
                return false;
            }

            var state = control.GetType().GetProperty(statePropertyName, BindingFlags.Instance | BindingFlags.Public)?.GetValue(control);
            return state is bool pressed && pressed;
        }

        private static object GetCurrentKeyboard()
        {
            EnsureInputSystemTypes();
            return keyboardCurrentProperty?.GetValue(null);
        }

        private static object GetCurrentMouse()
        {
            EnsureInputSystemTypes();
            return mouseCurrentProperty?.GetValue(null);
        }

        private static void EnsureInputSystemTypes()
        {
            if (keyboardCurrentProperty != null || mouseCurrentProperty != null)
            {
                return;
            }

            keyboardType = Type.GetType("UnityEngine.InputSystem.Keyboard, Unity.InputSystem");
            mouseType = Type.GetType("UnityEngine.InputSystem.Mouse, Unity.InputSystem");
            keyboardCurrentProperty = keyboardType?.GetProperty("current", BindingFlags.Static | BindingFlags.Public);
            mouseCurrentProperty = mouseType?.GetProperty("current", BindingFlags.Static | BindingFlags.Public);
        }

        private static string KeyCodeToInputSystemProperty(KeyCode key)
        {
            switch (key)
            {
                case KeyCode.Space:
                    return "spaceKey";
                case KeyCode.R:
                    return "rKey";
                case KeyCode.Alpha1:
                    return "digit1Key";
                case KeyCode.Alpha2:
                    return "digit2Key";
                case KeyCode.B:
                    return "bKey";
                case KeyCode.End:
                    return "endKey";
                case KeyCode.H:
                    return "hKey";
                case KeyCode.Home:
                    return "homeKey";
                case KeyCode.LeftArrow:
                    return "leftArrowKey";
                case KeyCode.N:
                    return "nKey";
                case KeyCode.P:
                    return "pKey";
                case KeyCode.RightArrow:
                    return "rightArrowKey";
                case KeyCode.Tab:
                    return "tabKey";
                case KeyCode.T:
                    return "tKey";
                case KeyCode.V:
                    return "vKey";
                default:
                    return null;
            }
        }
    }
}
