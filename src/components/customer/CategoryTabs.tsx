"use client";

import { MenuItemCard } from "@/components/customer/MenuItemCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CategoryWithItems, MenuItemWithOptions } from "@/types";

interface CategoryTabsProps {
  categories: CategoryWithItems[];
  onSelectItem: (item: MenuItemWithOptions) => void;
}

export function CategoryTabs({ categories, onSelectItem }: CategoryTabsProps) {
  if (categories.length === 0) return null;

  return (
    <Tabs defaultValue={categories[0]?.id ?? ""} className="w-full">
      <TabsList>
        {categories.map((category) => (
          <TabsTrigger key={category.id} value={category.id}>
            {category.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {categories.map((category) => (
        <TabsContent key={category.id} value={category.id}>
          {category.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Danh mục này chưa có món nào.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 pb-24 sm:grid-cols-3">
              {category.items.map((item) => (
                <MenuItemCard key={item.id} item={item} onSelect={onSelectItem} />
              ))}
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
