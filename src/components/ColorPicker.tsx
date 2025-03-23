
import { useRef, useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
}

export const ColorPicker = ({ color, onChange }: ColorPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Predefined color palette
  const colorPalette = [
    "#ef4444", // red
    "#f97316", // orange
    "#eab308", // yellow
    "#22c55e", // green
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#6366f1", // indigo
    "#a855f7", // purple
    "#d946ef", // pink
    "#000000", // black
    "#71717a", // zinc
    "#ffffff", // white
  ];

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleColorSelect = (selectedColor: string) => {
    onChange(selectedColor);
    setIsOpen(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-10 h-10 p-0 border-2"
            style={{ backgroundColor: color }}
          >
            <span className="sr-only">Choisir une couleur</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3">
          <div className="space-y-3">
            <div className="grid grid-cols-6 gap-2">
              {colorPalette.map((paletteColor) => (
                <button
                  key={paletteColor}
                  className={cn(
                    "h-6 w-6 rounded-md border border-gray-200",
                    color === paletteColor && "ring-2 ring-primary ring-offset-2"
                  )}
                  style={{ backgroundColor: paletteColor }}
                  onClick={() => handleColorSelect(paletteColor)}
                  type="button"
                />
              ))}
            </div>
            <Input
              ref={inputRef}
              type="color"
              value={color}
              onChange={handleColorChange}
              className="h-10"
            />
          </div>
        </PopoverContent>
      </Popover>
      <Input value={color} onChange={handleColorChange} className="font-mono" />
    </div>
  );
};
