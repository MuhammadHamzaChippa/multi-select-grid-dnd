import { useState, useMemo } from "react";
import { data } from "./data";
import "./App.css";
import {
	DndContext,
	PointerSensor,
	TouchSensor,
	KeyboardSensor,
	DragOverlay,
	closestCenter,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import {
	sortableKeyboardCoordinates,
	rectSortingStrategy,
	SortableContext,
	arrayMove,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FaCheckCircle } from "react-icons/fa";
import { snapCenterToCursor } from "@dnd-kit/modifiers";

const Card = ({ card, handleCardSelect, selectedCards }) => {
	const { setNodeRef, attributes, listeners, transition, transform, isDragging } = useSortable({
		id: card.title,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div className="relative" onClick={() => handleCardSelect(card)} style={style}>
			{selectedCards.includes(card) && (
				<FaCheckCircle className="absolute right-[8px] top-[8px] text-[#1976d2]" />
			)}
			<img
				{...attributes}
				{...listeners}
				ref={setNodeRef}
				src={card.image}
				title={card.title}
				className="h-[100px] w-[300px] cursor-pointer rounded-[8px]"
			/>
		</div>
	);
};

const Stack = ({ stack, handleCardSelect, filterCards, selectedCards }) => {
	const { setNodeRef } = useDroppable({
		id: stack.title,
	});
	return (
		<div
			ref={setNodeRef}
			className="grid grid-cols-4 gap-[10px] bg-[white] rounded-[8px] h-fit p-[12px]"
		>
			<SortableContext
				items={stack.cards.map((card) => card.title)}
				strategy={rectSortingStrategy}
			>
				{filterCards(stack).map((card) => (
					<Card
						key={card.title}
						selectedCards={selectedCards}
						card={card}
						handleCardSelect={handleCardSelect}
					/>
				))}
			</SortableContext>
		</div>
	);
};
function App() {
	const [stacks, setStacks] = useState(data);
	const [selectedCards, setSelectedCards] = useState([]);
	const [activeCard, setActiveCard] = useState(null);

	const findContainer = (id) => {
		if (id in stacks) {
			return id;
		}
		return Object.keys(stacks).find((stack) =>
			stacks[stack].cards.map((card) => card.title).includes(id)
		);
	};

	const handleCardSelect = (card) => {
		setSelectedCards((selectedCards) => {
			if (selectedCards.includes(card)) {
				return selectedCards.filter((value) => value.title !== card.title);
			}

			return selectedCards.concat(card);
		});
	};

	function filterCards(stack) {
		if (!activeCard) {
			return stack.cards;
		}

		return stack.cards.filter(
			(card) =>
				card.title === activeCard.title ||
				!selectedCards.map((c) => c.title).includes(card.title)
		);
	}

	const initalStack = useMemo(
		() => (activeCard ? findContainer(activeCard.title) : null),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[activeCard]
	);

	const handleDragStartGrid = (result) => {
		const { active } = result;
		const stack = findContainer(active.id);
		const idx = stacks[stack].cards.findIndex((card) => card.title === active.id);
		setSelectedCards((selectedCards) =>
			selectedCards.map((card) => card.title).includes(active.id) ? selectedCards : []
		);
		setActiveCard(stacks[stack].cards[idx]);
	};

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 2 },
		}),
		useSensor(TouchSensor, {}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDragOverGrid = async (result) => {
		const { active, over } = result;
		const overId = over?.id;
		if (overId == null || active.id in stacks) {
			return;
		}

		const overStack = findContainer(overId);
		const activeStack = findContainer(active.id);
		if (!overStack || !activeStack) {
			console.log("No stack found");
			return;
		}

		if (activeStack !== overStack) {
			setStacks((stacks) => {
				const activeStackCards = stacks[activeStack].cards;
				const overStackCards = stacks[overStack].cards;

				const overIndex = overStackCards.findIndex((card) => card.title === overId);
				const activeIndex = activeStackCards.findIndex((card) => card.title === active.id);
				let newIndex;

				if (overId in stacks) {
					newIndex = overStackCards.length + 1;
				} else {
					const isBelowOverItem =
						over &&
						active.rect.current.translated &&
						active.rect.current.translated.top > over.rect.top + over.rect.height;

					const modifier = isBelowOverItem ? 1 : 0;

					newIndex = overIndex >= 0 ? overIndex + modifier : overStackCards.length + 1;
				}

				const updatedActiveStack = {
					...stacks[activeStack],
					cards: stacks[activeStack].cards.filter((card) => card.title !== active.id),
				};

				const updatedOverStack = {
					...stacks[overStack],
					cards: [
						...stacks[overStack].cards.slice(0, newIndex),
						stacks[activeStack].cards[activeIndex],
						...stacks[overStack].cards.slice(newIndex, stacks[overStack].cards.length),
					],
				};

				return {
					...stacks,
					[activeStack]: updatedActiveStack,
					[overStack]: updatedOverStack,
				};
			});
		}
	};

	const handleDragEndGrid = async (result) => {
		const { active, over } = result;
		const activeStack = findContainer(active.id);

		if (!activeStack) {
			setActiveCard(null);
			return;
		}

		const overId = over?.id;
		if (overId === null) {
			setActiveCard(null);
			return;
		}

		const ids = selectedCards.length
			? [activeCard, ...selectedCards.filter((card) => card.title !== active.id)]
			: [activeCard];

		const overStack = findContainer(overId);
		if (overStack) {
			setStacks((stacks) => {
				const overItems = filterCards(stacks[overStack]);
				const overIndex = overItems.findIndex((card) => card.title === overId);
				const activeIndex = overItems.findIndex((card) => card.title === active.id);
				const newItems = arrayMove(overItems, activeIndex, overIndex);
				const newActiveIndex = newItems.findIndex((card) => card.title === active.id);

				return {
					...stacks,
					[initalStack]: {
						...stacks[initalStack],
						cards: stacks[initalStack].cards.filter(
							(card) => !ids.map((c) => c.title).includes(card.title)
						),
					},
					[activeStack]: {
						...stacks[activeStack],
						cards: stacks[activeStack].cards.filter(
							(card) => !ids.map((c) => c.title).includes(card.title)
						),
					},
					[overStack]: {
						...stacks[overStack],
						cards: [
							...newItems.slice(0, newActiveIndex + 1),
							...ids.filter((card) => card.title !== active.id),
							...newItems.slice(newActiveIndex + 1, newItems.length),
						],
					},
				};
			});
			// await axios
		}
		setSelectedCards([]);
		setActiveCard(null);
	};

	const handleDragCancelGrid = () => {
		setActiveCard(null);
		setSelectedCards([]);
	};

	return (
		<DndContext
			sensors={sensors}
			onDragEnd={handleDragEndGrid}
			onDragStart={handleDragStartGrid}
			onDragOver={handleDragOverGrid}
			onDragCancel={handleDragCancelGrid}
			collisionDetection={closestCenter}
		>
			<div className="bg-[lightgrey] w-[100%] h-[100vh] flex gap-[20px] p-[20px] justify-center">
				{Object.keys(stacks).map((stack) => (
					<Stack
						stack={stacks[stack]}
						key={stack.title}
						handleCardSelect={handleCardSelect}
						selectedCards={selectedCards}
						filterCards={filterCards}
					/>
				))}
			</div>
			<DragOverlay modifiers={[snapCenterToCursor]}>
				{activeCard ? <Card card={activeCard} selectedCards={selectedCards} /> : null}
			</DragOverlay>
		</DndContext>
	);
}

export default App;
