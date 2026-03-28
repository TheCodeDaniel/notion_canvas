// src/types/design-ir.ts
// These types are derived from the Zod schema in src/interpreter/schema.ts
// Use z.infer<typeof DesignIRZ> as the canonical source of truth.

export interface Color {
  r: number; // 0–1
  g: number; // 0–1
  b: number; // 0–1
  a: number; // 0–1, default 1
}

export type FontWeight = 'Regular' | 'Medium' | 'SemiBold' | 'Bold';
export type TextAlign = 'LEFT' | 'CENTER' | 'RIGHT';
export type LayoutMode = 'NONE' | 'VERTICAL' | 'HORIZONTAL';
export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type InputType = 'text' | 'email' | 'password' | 'number';
export type ScreenType = 'mobile' | 'web' | 'tablet';
export type Theme = 'light' | 'dark';
export type DesignSystem = 'material3' | 'cupertino' | 'custom';
export type FontFamily = 'Inter' | 'Roboto' | 'SF Pro' | 'Plus Jakarta Sans';

export interface FrameComponent {
  type: 'frame';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: Color;
  cornerRadius?: number;
  layoutMode: LayoutMode;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  children: Component[];
}

export interface TextComponent {
  type: 'text';
  name: string;
  x: number;
  y: number;
  width: number;
  content: string;
  fontSize: number;
  fontWeight: FontWeight;
  fillColor?: Color;
  textAlignHorizontal: TextAlign;
}

export interface RectangleComponent {
  type: 'rectangle';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fillColor?: Color;
  cornerRadius?: number;
  strokeColor?: Color;
  strokeWidth?: number;
}

export interface InputFieldComponent {
  type: 'input_field';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  placeholder: string;
  inputType: InputType;
}

export interface ButtonComponent {
  type: 'button';
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  variant: ButtonVariant;
  fillColor?: Color;
}

export type Component =
  | FrameComponent
  | TextComponent
  | RectangleComponent
  | InputFieldComponent
  | ButtonComponent;

export interface DesignIR {
  screenName: string;
  width: number;
  height: number;
  backgroundColor?: Color;
  components: Component[];
}

export interface DesignOptions {
  screenType: ScreenType;
  primaryColor?: string;
  fontFamily: FontFamily;
  theme: Theme;
  designSystem: DesignSystem;
}
