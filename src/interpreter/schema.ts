// src/interpreter/schema.ts
import { z } from 'zod';

const ColorZ = z.object({
  r: z.number().min(0).max(1),
  g: z.number().min(0).max(1),
  b: z.number().min(0).max(1),
  a: z.number().min(0).max(1).default(1),
});

const ComponentZ: z.ZodType<unknown> = z.lazy(() =>
  z.discriminatedUnion('type', [
    // Frame
    z.object({
      type: z.literal('frame'),
      name: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      fillColor: ColorZ.optional(),
      cornerRadius: z.number().optional(),
      layoutMode: z.enum(['NONE', 'VERTICAL', 'HORIZONTAL']).default('NONE'),
      paddingLeft: z.number().optional(),
      paddingRight: z.number().optional(),
      paddingTop: z.number().optional(),
      paddingBottom: z.number().optional(),
      itemSpacing: z.number().optional(),
      children: z.array(z.lazy(() => ComponentZ)).default([]),
    }),
    // Text
    z.object({
      type: z.literal('text'),
      name: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      content: z.string(),
      fontSize: z.number().default(16),
      fontWeight: z.enum(['Regular', 'Medium', 'SemiBold', 'Bold']).default('Regular'),
      fillColor: ColorZ.optional(),
      textAlignHorizontal: z.enum(['LEFT', 'CENTER', 'RIGHT']).default('LEFT'),
    }),
    // Rectangle
    z.object({
      type: z.literal('rectangle'),
      name: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
      fillColor: ColorZ.optional(),
      cornerRadius: z.number().optional(),
      strokeColor: ColorZ.optional(),
      strokeWidth: z.number().optional(),
    }),
    // Input field
    z.object({
      type: z.literal('input_field'),
      name: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number().default(48),
      placeholder: z.string(),
      inputType: z.enum(['text', 'email', 'password', 'number']),
    }),
    // Button
    z.object({
      type: z.literal('button'),
      name: z.string(),
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number().default(48),
      label: z.string(),
      variant: z.enum(['primary', 'secondary', 'ghost', 'destructive']),
      fillColor: ColorZ.optional(),
    }),
  ])
);

export const DesignIRZ = z.object({
  screenName: z.string(),
  width: z.number().default(390),
  height: z.number().default(844),
  backgroundColor: ColorZ.optional(),
  components: z.array(ComponentZ),
});

export type DesignIR = z.infer<typeof DesignIRZ>;
export type Color = z.infer<typeof ColorZ>;
