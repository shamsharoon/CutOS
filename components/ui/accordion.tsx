"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn("border-b", className)}
    {...props}
  />
))
AccordionItem.displayName = "AccordionItem"

// Animated chevron that responds to data-state
const AnimatedChevron = () => {
  const ref = React.useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    const trigger = ref.current?.closest('[data-state]')
    if (!trigger) return

    const observer = new MutationObserver(() => {
      const state = trigger.getAttribute('data-state')
      setIsOpen(state === 'open')
    })

    // Initial state
    setIsOpen(trigger.getAttribute('data-state') === 'open')

    observer.observe(trigger, { attributes: true, attributeFilter: ['data-state'] })
    return () => observer.disconnect()
  }, [])

  return (
    <motion.div
      ref={ref}
      animate={{ rotate: isOpen ? 180 : 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20,
      }}
      className="shrink-0"
    >
      <motion.div
        whileHover={{ scale: 1.2 }}
        whileTap={{ scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      </motion.div>
    </motion.div>
  )
}

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  return (
    <AccordionPrimitive.Header className="flex">
      <AccordionPrimitive.Trigger
        ref={ref}
        className={cn(
          "group flex flex-1 items-center justify-between py-4 font-medium transition-all cursor-pointer hover:underline",
          className
        )}
        {...props}
      >
        <motion.div
          className="flex flex-1 items-center"
          whileHover={{ x: 2 }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          {children}
        </motion.div>
        <AnimatedChevron />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
})
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <motion.div
      className={cn("pb-4 pt-0", className)}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        delay: 0.05
      }}
    >
      {children}
    </motion.div>
  </AccordionPrimitive.Content>
))

AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
