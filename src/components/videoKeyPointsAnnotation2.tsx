//@ts-nocheck
import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Stage,
  Layer,
  Circle,
  Line,
  Text,
  Rect,
  Label,
  Tag,
} from "react-konva";

import ReactPlayer from "react-player";
import dummyVideo from "./dummy-walking_2.mp4";
import { generateUniqueId } from "../services/idHelperService.ts";
import { DUMMY_ANNOTATIONS } from "./dummyData.js";
// import { Card, IconButton, Input, Switch, TextField } from "@material-ui/core";
// import { Delete } from "@material-ui/icons";
import { Card, IconButton, TextField, Button } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DeletePopup from './DeletePopup.tsx';
import { Annotation } from '../types/annotation.ts';
import { secondsToFrame, frameToSeconds } from '../utils/time.ts';
import { isPointNearDot, normalizeSelectionBox, isDotInsideBox } from '../utils/geometry.ts';
import { removeLineFromFrame, removeDotFromFrame } from '../utils/annotations.ts';
import { annotationsToDotsCsv, annotationsToLinesCsv, downloadCsv } from '../utils/csv.ts';
import { SKELETON_TEMPLATES, applySkeletonTemplate, SkeletonTemplate } from '../utils/skeletonTemplates.ts';
import { UndoRedoManager } from '../utils/undoRedo.ts';

const DEFAULT_FRAME_RATE = 15;

const VideoAnnotations2 = () => {
  const [allVideoAnnotations, setAllVideoAnnotations] =
    useState<Array<Annotation>>(DUMMY_ANNOTATIONS);
  const [fps, setFps] = useState<number>(DEFAULT_FRAME_RATE);
  const [videoUrl, setVideoUrl] = useState<string>(dummyVideo);
  const [keypointsPerFrame, setKeypointsPerFrame] = useState({}); // Store keypoints per frame
  // const [currentKeypoints, setCurrentKeypoints] = useState([]);    // Keypoints for current frame
  // const [lastEditedFrameContext, setLastEditedFrameContext] = useState<{
  //     frame: number,
  //     annotationIds: Array<string>,
  //     dotIds: Array<string>,
  //     lineIds: Array<string>
  // }>({});
  const [showPopup, setShowPopup] = useState(false);
  const [showDeleteAllPopup, setShowDeleteAllPopup] = useState(false);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const [dotToDelete, setDotToDelete] = useState(null);
  const [showLinePopup, setShowLinePopup] = useState(false);
  const [popupLinePosition, setPopupLinePosition] = useState({ x: 0, y: 0 });
  const [lineToDelete, setLineToDelete] = useState(null);
  const [lines, setLines] = useState({});
  // const [currentLines, setCurrentLines] = useState([])
  const [lastSavedLines, setLastSavedLines] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false); // Video play state
  const [currentTime, setCurrentTime] = useState(0); // Current time of the video in seconds
  const [currentFrame, setCurrentFrame] = useState<number>(1);
  const [duration, setDuration] = useState(0); // Duration of the video
  const playerRef = useRef(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string>("");
  const [selectedPoints, setSelectedPoints] = useState([]); // Track the clicked dots
  const [hoveredDotId, setHoveredDotId] = useState(null); // Track hovered dot
  const [previousDot, setPreviousDot] = useState(null); // Track the previous dot
  const [hoveredLineIndex, setHoveredLineIndex] = useState(null); // Track the hovered line for deletion
  const [deleteLineIndex, setDeleteLineIndex] = useState(null); // Index of the line for deletion
  const [isDotLabelsEnabled, setIsDotLabelsEnabled] = useState<boolean>(false);
  const [isSelecting, setIsSelecting] = useState(false); // Whether the user is currently selecting with the box
  const [isDraggingSelectionBox, setIsDraggingSelectionBox] = useState(false);
  const [selectionBox, setSelectionBox] = useState({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  }); // Selection box
  const [isCtrlPressed, setIsCtrlPressed] = useState(false); // Track if Ctrl key is pressed    const [isDotLabelsEnabled, setIsDotLabelsEnabled] = useState<boolean>(false);
  const totalFrames = duration * fps;
  const [boundingBoxSelectedDots, setBoundingBoxSelectedDots] = useState([]); // Track selected dots within bounding box area
  const [isMouseDragging, setIsMouseDragging] = useState(false);
  const [mouseDownPosition, setMouseDownPosition] = useState({ x: 0, y: 0 });
  const [mouseDownTime, setMouseDownTime] = useState(null);
  const CLICK_THRESHOLD = 300;
  // Accessibility controls
  const [dotRadius, setDotRadius] = useState<number>(3);
  const [lineStrokeWidth, setLineStrokeWidth] = useState<number>(2);
  // Skeleton template state
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  // Undo/Redo state
  const [undoRedoManager] = useState(() => new UndoRedoManager());
  const [undoRedoInfo, setUndoRedoInfo] = useState({ canUndo: false, canRedo: false, currentAction: 'Initial state', totalStates: 1 });
  console.log({ allVideoAnnotations });
  //set current frame number on time change
  useEffect(() => {
    const calculatedFrame = secondsToFrame(currentTime, fps);
    if (calculatedFrame !== currentFrame) {
      setCurrentFrame(calculatedFrame);
      resetSelections();
      setBoundingBoxSelectedDots([]);
    }
  }, [currentTime, fps]);

  console.log("testing~allVideoAnnotations", allVideoAnnotations);

  const handleUploadVideo = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setCurrentTime(0);
    setCurrentFrame(1);
    setIsPlaying(false);
  };

  const handleDownloadDotsCsv = () => {
    const csv = annotationsToDotsCsv(allVideoAnnotations, fps);
    downloadCsv('annotations_dots.csv', csv);
  };

  const handleDownloadLinesCsv = () => {
    const csv = annotationsToLinesCsv(allVideoAnnotations, fps);
    downloadCsv('annotations_lines.csv', csv);
  };

  const handleApplySkeletonTemplate = () => {
    if (!selectedTemplate) return;
    
    const template = SKELETON_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!template) return;

    // Save current state before applying template
    saveToHistory(`Apply ${template.name} template`);

    // Apply template at center of video
    const { dots, lines } = applySkeletonTemplate(template, 400, 225);
    
    setAllVideoAnnotations(prev => {
      const newAnnotations = [...prev];
      newAnnotations.push({
        id: generateUniqueId(),
        label: template.name,
        frames: [{
          frame: currentFrame,
          dots,
          lines,
        }]
      });
      return newAnnotations;
    });
    
    setSelectedTemplate(''); // Reset selection
  };

  // Undo/Redo helper functions
  const saveToHistory = (action: string) => {
    undoRedoManager.saveState(allVideoAnnotations, action);
    setUndoRedoInfo(undoRedoManager.getHistoryInfo());
  };

  const handleUndo = () => {
    const previousState = undoRedoManager.undo();
    if (previousState) {
      setAllVideoAnnotations(previousState);
      setUndoRedoInfo(undoRedoManager.getHistoryInfo());
    }
  };

  const handleRedo = () => {
    const nextState = undoRedoManager.redo();
    if (nextState) {
      setAllVideoAnnotations(nextState);
      setUndoRedoInfo(undoRedoManager.getHistoryInfo());
    }
  };

  // Keyboard event handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 'z' && !event.shiftKey) {
          event.preventDefault();
          handleUndo();
        } else if ((event.key === 'y') || (event.key === 'z' && event.shiftKey)) {
          event.preventDefault();
          handleRedo();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [allVideoAnnotations]);

  // useEffect(() => {
  //     // Load annotations when video is loaded
  //     if (playerRef.current) {
  //         playerRef.current.seekTo(currentTime);
  //     }
  // }, [currentTime, playerRef])

  // useEffect(() => {
  //     // Load keypoints when currentTime is updated
  //     loadKeypointsForFrame(currentTime);
  //     loadLinesForFrame(currentTime);
  // }, [currentTime]);

  // const getCurrentTimeKey = (timeInMs: number): string => {
  //     return Math.floor(time).toString();
  // }

  // populate last frame's keypoints to edit for current frame
  // useEffect(() => {
  //   if(!isPlaying){
  //     setCurrentKeypoints([]);
  //     setCurrentLines([]);
  //   }
  // }, [isPlaying])

  const loadKeypointsForFrame = (time) => {
    const frameKey = Math.floor(time);
    // setCurrentKeypoints(keypointsPerFrame[frameKey] || []);
  };

  // const loadLinesForFrame = (time) => {
  //     const frameKey = Math.floor(time);
  //     setCurrentLines(lines[frameKey] || []);
  // };

  const handleLoadPrevAnnotations = () => {
    saveToHistory('Load previous annotations');
    setAllVideoAnnotations((prev) => {
      const newAnnotations = [...prev];
      let lastFrameThatHaveAnnotations = currentFrame - 1;
      while (lastFrameThatHaveAnnotations >= 0) {
        let annFound = false;
        allVideoAnnotations.forEach((ann) => {
          ann.frames.forEach((frameObj) => {
            if (frameObj.frame === lastFrameThatHaveAnnotations) {
              annFound = true;
              return;
            }
          });
          if (annFound) {
            return;
          }
        });
        if (annFound) {
          break;
        }
        lastFrameThatHaveAnnotations--;
      }

      console.log(
        "lastFrameThatHaveAnnotations: ",
        lastFrameThatHaveAnnotations
      );

      if (lastFrameThatHaveAnnotations) {
        newAnnotations.map((ann) => {
          const frameObjToCopy = ann.frames.find(
            (frameObj) => frameObj.frame === lastFrameThatHaveAnnotations
          );

          if (frameObjToCopy) {
            ann.frames = [
              ...ann.frames.filter(
                (frameObj) => frameObj.frame !== currentFrame
              ),
              {
                frame: currentFrame,
                dots: [...(frameObjToCopy.dots || [])],
                lines: [...(frameObjToCopy.lines || [])],
              },
            ];
          }
          return ann;
        });
      }

      // newAnnotations.map(annotation => {
      //     if( lastEditedFrameContext.annotationIds?.indexOf(annotation.id) !== -1 ){
      //         let dotsPushedInCurrentFrameObj = false;
      //         annotation.frames.map(frameObj => {
      //             // for current frame, push dots
      //             if(frameObj.frame === currentFrame){
      //                 // frameObj.dots.concat(frameObj.dots.filter(dot => lastEditedFrameContext.dotIds?.indexOf(dot.id) !== -1));
      //                 frameObj.dots.concat(annotation.frames.find(frameObj => frameObj.frame === lastEditedFrameContext.frame)?.dots.filter(dot => lastEditedFrameContext.dotIds.indexOf(dot.id) !== -1))
      //                 dotsPushedInCurrentFrameObj = true;
      //                 return frameObj;
      //             }
      //             return frameObj;
      //         })
      //         if(dotsPushedInCurrentFrameObj === false){
      //             annotation.frames.push({
      //                 frame: currentFrame,
      //                 dots: [...annotation.frames.find(frameObj => frameObj.frame === lastEditedFrameContext.frame)?.dots.filter(dot => lastEditedFrameContext.dotIds.indexOf(dot.id) !== -1)],
      //                 lines: []
      //             })
      //         }
      //         return annotation;
      //     }
      //     return annotation;
      // })

      // // reset frame number of context to current frame
      // setLastEditedFrameContext(prev => {
      //     return {
      //         ...prev,
      //         frame: currentFrame
      //     }
      // })

      return newAnnotations;
    });
  };

  // console.log("^^^^^^^^^^^^^^^^^^^^^^^", lastEditedFrameContext)

  const handleCanvasClick = (e) => {
    e.evt.preventDefault();
    if (isPlaying) return;
    if (e.evt.button === 2) {
      // Check for right-click
      // e.evt.preventDefault();
      setSelectedPoints([]);
      setPreviousDot(null);
      setDeleteLineIndex(null);
      return; // Exit function to prevent dot creation
    } else if (e.evt.button === 1) {
      // Check for cursor-click
      // setCurrentKeypoints([]); // Reset keypoints
      //   setCurrentLines([]); // Reset lines
      setBoundingBoxSelectedDots([]);
      setSelectedPoints([]); // Reset selected points
      setPreviousDot(null); // Reset previous dot
      setDeleteLineIndex(null); // Reset delete line index

      // Delete all annotations for the current frame
      saveToHistory('Delete all annotations in frame');
      setAllVideoAnnotations((prevAnnotations) => {
        return prevAnnotations
          .map((annotation) => {
            return {
              ...annotation,
              frames: annotation.frames.filter(
                (frame) => frame.frame !== currentFrame
              ),
            };
          })
          .filter((annotation) => annotation.frames.length > 0); // Remove annotations that have no frames left
      });
      return;
      return;
    } else if (boundingBoxSelectedDots.length > 0) {
      //don't create new dot while releasing the bounding box
      return;
    }
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let isClickOnDot = false;
    currentAnnotations.forEach((ann) => {
      ann.frames.forEach((timestamp) => {
        timestamp.dots.forEach((dot) => {
          if (isPointNearDot(point.x, point.y, dot as any, Math.max(dotRadius + 2, 8))) {
            isClickOnDot = true;
            return;
          }
        });
        if (isClickOnDot) return;
      });
    });
    if (!isClickOnDot) {
      // Create a new dot
      const newDot = {
        id: generateUniqueId(),
        x: point.x,
        y: point.y,
        color: "black",
      };
      console.log({ newDot, isClickOnDot });
      saveToHistory('Add dot');
      setAllVideoAnnotations((prev) => {
        const newAnnotations = [...prev];

        // Case 1: If no dots are selected (current or previous), create a new annotation
        if (!previousDot && selectedPoints.length === 0) {
          newAnnotations.push({
            id: generateUniqueId(),
            label: "",
            frames: [
              {
                frame: currentFrame,
                dots: [newDot],
                lines: [],
              },
            ],
          });
        }

        // Case 2: If a dot is selected (current or previous), append to the selected annotation's dots array
        else if (selectedPoints.length > 0) {
          const selectedDot = selectedPoints[0]; // Get the selected dot
          const annotationId = selectedAnnotationId; // Use the ID of the currently selected annotation
          newAnnotations.forEach((annotation) => {
            console.log({ annotation, selectedAnnotationId });
            if (annotation.id === selectedAnnotationId) {
              let frame = annotation.frames.find(
                (f) => f.frame === currentFrame
              );
              if (frame) {
                frame.dots.push(newDot); // Add dot to existing frame
              } else {
                annotation.frames.push({
                  frame: currentFrame,
                  dots: [newDot], // New frame with the dot
                  lines: [],
                });
              }
            }
          });
          // setSelectedPoints([...selectedPoints, newDot]);  // Append the new dot to selected points
          // setPreviousDot(selectedPoints[0]);
        }
        return newAnnotations;
      });
    }
    // setPreviousDot(null);
  };

  const handleLineRightClick = (e, lineId, annotationId) => {
    e.evt.preventDefault(); // Prevent default right-click menu

    // Set popup position based on cursor position
    const { clientX, clientY } = e.evt;
    setPopupLinePosition({ x: clientX, y: clientY });

    // Set the line to be deleted
    setLineToDelete({ id: lineId, annotationId });
    setShowLinePopup(true); // Show the delete popup
  };
  const handleLineClick = (idx) => {
    // Show the cross for deleting the line
    setDeleteLineIndex(idx);
  };
  const handleDeleteLine = () => {
    if (lineToDelete) {
      const { id, annotationId } = lineToDelete;

      saveToHistory('Delete line');
      setAllVideoAnnotations((prev) => {
        const newAnnotations = [...prev];
        const annotation = newAnnotations.find(
          (ann) => ann.id === annotationId
        );
        if (annotation) {
          const frame = annotation.frames.find((f) => f.frame === currentFrame);
          if (frame) {
            removeLineFromFrame(frame, id);
          }
        }

        return newAnnotations;
      });
      setDeleteLineIndex(null);
      setShowLinePopup(false);
      // Update last edited frame
      // setLastEditedFrameContext(currentFrame);
    }
    setShowLinePopup(false);
  };

  // const handleClickSaveAnnotations = () => {
  //     // setLastSavedKeypoints(currentKeypoints);
  //     setLastSavedLines(currentLines);
  //     saveKeypointsForFrame();
  //     saveLinesForFrame();
  // }
  // Function to delete all dots selected by the bounding box
  const handleDeleteAllSelectedDots = () => {
    // Logic to remove the dots from the current annotations
    console.log("ppp", { boundingBoxSelectedDots });
    // const updatedAnnotations = currentAnnotations.map(annotation => ({
    //     ...annotation,
    //     frames: annotation.frames.map(frameObj => ({
    //         ...frameObj,
    //         dots: frameObj.dots.filter(dot =>
    //             !boundingBoxSelectedDots.some(selectedDot => selectedDot.id === dot.id)  // Compare by dot ID
    //         ),
    //         //update lines connected to these dots:
    //         lines: frameObj.lines.filter(line =>
    //             !boundingBoxSelectedDots.some(selectedDot =>
    //                 line.startDotId === selectedDot.id || line.endDotId === selectedDot.id
    //             )
    //         )
    //     }))
    // }));
    setAllVideoAnnotations((prev) => {
      const updatedAnnotations = prev
        .map((annotation) => {
          const updatedFrames = annotation.frames.map((frameObj) => {
            // Only operate on the current frame
            if (frameObj.frame === currentFrame) {
              const updatedDots = frameObj.dots.filter(
                (dot) =>
                  !boundingBoxSelectedDots.some(
                    (selectedDot) => selectedDot.id === dot.id
                  ) // Compare by dot ID
              );

              // Filter out lines connected to deleted dots
              const updatedLines = frameObj.lines.filter(
                (line) =>
                  !boundingBoxSelectedDots.some(
                    (selectedDot) =>
                      line.startDotId === selectedDot.id ||
                      line.endDotId === selectedDot.id
                  )
              );

              return {
                ...frameObj,
                dots: updatedDots,
                lines: updatedLines,
              };
            }
            return frameObj; // Keep other frames unchanged
          });

          // Remove frames that no longer have dots in the current frame
          const filteredFrames = updatedFrames.filter(
            (frame) => frame.dots.length > 0 || frame.frame !== currentFrame
          );

          return filteredFrames.length > 0
            ? {
              ...annotation,
              frames: filteredFrames,
            }
            : null; // Remove the annotation if all frames are empty
        })
        .filter((annotation) => annotation !== null);

      return updatedAnnotations;
    });

    // setAllVideoAnnotations(updatedAnnotations);
    setBoundingBoxSelectedDots([]);
    setSelectedPoints([]);
    setShowDeleteAllPopup(false);
  };
  // Function to detect if a dot is within the selection box
  const isDotInsideSelectionBox = (dot) => {
    const { x, y, width, height } = selectionBox;
    return (
      dot.x >= x && dot.x <= x + width && dot.y >= y && dot.y <= y + height
    );
  };
  // Mouse down - start the selection box
  const handleMouseDown = (e) => {
    if (e.evt.button === 0) {
      // Left-click only
      const stage = e.target.getStage();
      const pointerPosition = stage.getPointerPosition();
      // Track mouse down time
      setMouseDownTime(Date.now());
      // Start creating the selection box
      setSelectionBox({
        x: pointerPosition.x,
        y: pointerPosition.y,
        width: 0,
        height: 0,
      });
      setIsSelecting(true);
      setIsDraggingSelectionBox(false);
    }
  };
  // Mouse move - update the selection box
  const handleMouseMove = (e) => {
    if (isSelecting && mouseDownTime !== null) {
      const elapsedTime = Date.now() - mouseDownTime;
      if (elapsedTime > CLICK_THRESHOLD) {
        const stage = e.target.getStage();
        const pointerPosition = stage.getPointerPosition();
        const newBox = {
          ...selectionBox,
          width: pointerPosition.x - selectionBox.x,
          height: pointerPosition.y - selectionBox.y,
        };
        setSelectionBox(newBox);
        setIsDraggingSelectionBox(false);

        // Calculate selected dots based on the updated box
        const selected = calculateSelectedDots(newBox);
        setBoundingBoxSelectedDots(selected);
      }
    }
  };

  const handleMouseUp = (e) => {
    if (e.evt.button !== 0) return; // Only proceed if it's a left-click
    setIsSelecting(false);
    const clickDuration = Date.now() - mouseDownTime;
    if (clickDuration > CLICK_THRESHOLD) {
      const stage = e.target.getStage();
      if (!stage) return;

      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return;

      // Finalize and set the dots selected within the selection box
      const finalSelectedDots = calculateSelectedDots(selectionBox);
      setBoundingBoxSelectedDots(finalSelectedDots);
      // setSelectedPoints(finalSelectedDots);  // Set selected points in global state
      // Reset the selection box to avoid visual glitches after selection
      setSelectionBox({
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      });
    }
  };

  // Helper to calculate which dots fall inside the selection box
  const calculateSelectedDots = (box) => {
    const normalizedBox = normalizeSelectionBox(box);
    return currentAnnotations.flatMap((annotation) =>
      annotation.frames
        .filter((frame) => frame.frame === currentFrame)
        .flatMap((obj) => obj.dots.filter((dot) => isDotInsideBox(dot as any, normalizedBox)))
    );
  };
  // Handle Ctrl key press
  const handleKeyDown = (e) => {
    if (e.key === "Control") {
      setIsCtrlPressed(true);
    }
  };

  const handleKeyUp = (e) => {
    if (e.key === "Control") {
      setIsCtrlPressed(false);
    }
  };
  // Function to delete selected dots and corresponding lines
  const deleteSelectedDotsAndLines = () => {
    saveToHistory('Delete selected dots and lines');
    setAllVideoAnnotations((prevAnnotations) => {
      const newAnnotations = [...prevAnnotations];
      newAnnotations.forEach((ann) => {
        ann.frames.forEach((frame) => {
          // Remove selected dots
          frame.dots = frame.dots.filter((dot) => !selectedDots.includes(dot));

          // Remove lines connected to any of the deleted dots
          frame.lines = frame.lines.filter(
            (line) =>
              !selectedDots.find(
                (dot) => dot.id === line.startDotId || dot.id === line.endDotId
              )
          );
        });
      });
      return newAnnotations;
    });

    setSelectedDots([]); // Reset selection
  };
  // const saveKeypointsForFrame = () => {
  //     const frameKey = Math.floor(currentTime);
  //     setKeypointsPerFrame({
  //         ...keypointsPerFrame,
  //         // [frameKey]: currentKeypoints,
  //     });
  // };

  // const saveLinesForFrame = () => {
  //     const lineKey = Math.floor(currentTime);
  //     setLines({
  //         ...lines,
  //         [lineKey]: currentLines,
  //     });
  // }

  // Custom control functions
  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value, 10);
    playerRef.current.seekTo(time); // Seek to the specified time
    setCurrentTime(time);
  };

  const formatTime = (time) => {
    // kept for UI, but we already have formatClock if needed
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60)
      .toString()
      .padStart(2, "0");
    return `${minutes}:${seconds}`;
  };

  const handleDotClick = (event, dotId, annotationId) => {
    const clickedPoint = (
      currentAnnotations.find((ann) => ann.id === annotationId) as Annotation
    ).frames
      .find((timestamp) => timestamp.frame === currentFrame)
      ?.dots.find((d) => d.id === dotId);
    setSelectedAnnotationId(annotationId);
    // event.evt.preventDefault();

    // If two dots are already selected, clear the selection
    console.log({ annotationId });
    if (selectedPoints.length === 2) {
      setSelectedPoints([clickedPoint]);
      setPreviousDot(null); // Reset previous dot when new selection begins
    } else if (
      selectedPoints.length === 1 &&
      selectedPoints[0] !== clickedPoint
    ) {
      // When two dots are selected, create a line
      const newLine = {
        id: generateUniqueId(),
        startDotId: selectedPoints[0].id,
        endDotId: clickedPoint.id,
        color: "#000000",
      };

      // Update the `allVideoAnnotations` state to add the new line to the correct frame
      saveToHistory('Add line');
      setAllVideoAnnotations((prevAnnotations) => {
        const newAnnotations = prevAnnotations.map((ann) => {
          if (ann.id === annotationId) {
            return {
              ...ann,
              frames: ann.frames.map((frame) => {
                if (frame.frame === currentFrame) {
                  return {
                    ...frame,
                    lines: [...frame.lines, newLine], // Add the new line to the frame's lines array
                  };
                }
                return frame;
              }),
            };
          }
          return ann;
        });

        return newAnnotations;
      });

      setPreviousDot(selectedPoints[0]); // Mark the first dot as the previous one
      setSelectedPoints([clickedPoint]); // Select the second dot
      // setLastEditedFrameContext(currentFrame);  // Set the last edited frame context
    } else {
      // Select the first dot
      setSelectedPoints([clickedPoint]);
      setPreviousDot(null); // Reset previous dot when new selection starts
    }
  };

  const handleDotDragMove = (e, annotationId, dotId) => {
    const { x, y } = e.target.position();

    setAllVideoAnnotations((prev) => {
      const newAnnotations = prev.map((ann) => {
        if (ann.id === annotationId) {
          return {
            ...ann,
            frames: ann.frames.map((frame) => {
              if (frame.frame === currentFrame) {
                return {
                  ...frame,
                  dots: frame.dots.map((dot) => {
                    if (dot.id === dotId) {
                      return { ...dot, x, y }; // Update dot position
                    }
                    return dot;
                  }),
                };
              }
              return frame;
            }),
          };
        }
        return ann;
      });
      return newAnnotations;
    });
  };
  const handleBoundingBoxRightClick = (e) => {
    e.evt.preventDefault(); // Prevent default context menu
    // Set position for the popup
    const { clientX, clientY } = e.evt;
    setPopupPosition({ x: clientX, y: clientY });
    setShowDeleteAllPopup(true); // Show popup for deleting all dots
  };
  const handleDotRightClick = (e, dotId, annotationId) => {
    e.evt.preventDefault(); // Prevent default context menu

    // Set position for the popup
    const { clientX, clientY } = e.evt;
    setPopupPosition({ x: clientX, y: clientY });
    setDotToDelete({ id: dotId, annotationId });
    setShowPopup(true);
  };
  const handleDeleteDot = () => {
    if (dotToDelete) {
      const { id, annotationId } = dotToDelete;

      saveToHistory('Delete dot');
      setAllVideoAnnotations((prev) => {
        const newAnnotations = [...prev];

        const annotation = newAnnotations.find(
          (ann) => ann.id === annotationId
        );
        if (annotation) {
          // Find the frame for the current frame
          const frame = annotation.frames.find((f) => f.frame === currentFrame);
          if (frame) {
            removeDotFromFrame(frame, id);
            if (frame.dots.length === 0) {
              const idx = newAnnotations.findIndex((ann) => ann.id === annotationId);
              if (idx !== -1) newAnnotations.splice(idx, 1);
            }
          }
        }

        return newAnnotations;
      });

      // Reset the state
      setDotToDelete(null);
      setShowPopup(false);
      setSelectedPoints([]);
      setPreviousDot(null);
    }
  };

  const handleRightClickOnScreen = (e) => {
    const { evt } = e;

    if (evt && evt.preventDefault) {
      evt.preventDefault(); // Prevent the default context menu
    } else {
      e.preventDefault();
    }
    // Check if the event is from the canvas stage
    const stage = e.target?.getStage?.();
    if (!stage) {
      // If not from the canvas (stage), simply reset selections
      resetSelections();
      return;
    }
    const point = stage.getPointerPosition();
    console.log({ point });
    if (!point) {
      resetSelections();
      return;
    }
    // Check if the right-click position is inside any selected dots
    const isInsideSelectedDots = boundingBoxSelectedDots.some((dot) => {
      const distance = Math.sqrt(
        Math.pow(dot.x - point.x, 2) + Math.pow(dot.y - point.y, 2)
      );
      return distance < 8;
    });
    if (!isInsideSelectedDots) {
      resetSelections();
      setBoundingBoxSelectedDots([]);
    } else {
      resetSelections();
    }
  };
  const resetSelections = () => {
    // setCurrentKeypoints([]); // Reset keypoints
    // setCurrentLines([]); // Reset lines
    setSelectedPoints([]); // Reset selected points
    setPreviousDot(null); // Reset previous dot
    setDeleteLineIndex(null); // Reset delete line index
    setSelectionBox(null); // Reset the selected area box
    // setBoundingBoxSelectedDots([])
  };
  const onDragDot = (event: any, dotId: string, annotationId: string) => {
    const { x, y } = event.target.position();
    saveToHistory('Move dot');
    setAllVideoAnnotations((prev) => {
      const newAnnotations = [...prev];

      newAnnotations
        .find((a) => a.id === annotationId)
        ?.frames?.map((frameObj) => {
          if (frameObj.frame === currentFrame) {
            const dot = frameObj.dots.find((d) => d.id === dotId);
            if (dot) {
              dot.x = x;
              dot.y = y;
            }
          }
          return frameObj;
        });

      return newAnnotations;
    });
  };

  // const doesCurrentFrameHaveKeyPoints = useMemo(() => {
  //     const key = Math.floor(currentTime);
  //     if (keypointsPerFrame[key]) {
  //         return true;
  //     }
  //     return false;
  // }, [currentTime, keypointsPerFrame])

  // const currentAnnotations = videoAnnotations.filter(ann => ann.timestamps.find(t => t.timeInMs === currentTime))
  // considering 1 fps rate
  // const currentAnnotations = allVideoAnnotations.filter(ann => ann.frames.find(t => t.timeInMs/1000 === currentTime/1000))
  const currentAnnotations = allVideoAnnotations.filter((ann) =>
    ann.frames.some((obj) => obj.frame === currentFrame)
  );
  // console.log("^^^^^^^^^^^^^^^currentAnnotations: ", currentAnnotations)

  console.log("***************", allVideoAnnotations);

  const onChangeFrameNumber = (event: any) => {
    const frame = parseInt(event.target.value);
    setCurrentFrame(frame);

    const time = frameToSeconds(frame, fps);
    console.log(">>>>> new frame: ", frame);
    console.log(">>>>> new time: ", time);
    playerRef.current.seekTo(time, "seconds"); // Seek to the specified time
    setCurrentTime(time);
  };

  const onChangeDotLabelsEnabled = (event: any) => {
    setDotLabelsEnabled(event.target.checked);
  };

  const onChangeAnnLabel = (newValue: string, annId: string) => {
    saveToHistory('Change annotation label');
    setAllVideoAnnotations((prevAnnotations) => {
      const newAnnotations = [...prevAnnotations];

      const objToUpdate = newAnnotations.find((ann) => ann.id === annId);
      if (objToUpdate) {
        objToUpdate.label = newValue;
      }

      return newAnnotations;
    });
  };

  const onDeleteaAnnotation = (annId: string) => {
    saveToHistory('Delete annotation');
    setAllVideoAnnotations((prevAnnotations) => {
      const newAnnotations = prevAnnotations.filter((ann) => ann.id !== annId);
      return newAnnotations;
    });
  };

  console.log("testing~current~time", currentTime);

  return (
    <>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div>
          <div
            style={{ position: "relative", width: "800px", height: "450px" }}
            onContextMenu={handleRightClickOnScreen}
          >
        {/* ReactPlayer Component */}
        <ReactPlayer
          ref={playerRef}
          url={videoUrl}
          width="800px"
          height="450px"
          playing={isPlaying}
          onProgress={({ playedSeconds }) => setCurrentTime(playedSeconds)}
          onDuration={(d) => setDuration(d)}
          style={{ position: "absolute", top: 0, left: 0 }}
          progressInterval={10}
        // playbackRate={0.4}
        />

        {/* Konva Stage for keypoints */}
        <Stage
          width={800}
          height={450}
          onClick={handleCanvasClick}
          style={{ position: "absolute", top: 0, left: 0 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onContextMenu={handleRightClickOnScreen}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          tabIndex={0} // Make sure the Stage is focusable
        >
          <Layer>
            {currentAnnotations.map((ann, index) => {
              return (
                <React.Fragment key={`ann-${index}`}>
                  {ann.frames
                    .filter((frame) => frame.frame === currentFrame)
                    .map((obj) => {
                      return (
                        <React.Fragment key={index}>
                          {obj.dots.map((point, idx) => {
                            return (
                              <React.Fragment key={idx}>
                                <Circle
                                  key={`circle-${idx}`}
                                  x={point.x}
                                  y={point.y}
                                  radius={dotRadius}
                                  fill={
                                    boundingBoxSelectedDots.includes(point)
                                      ? "blue"
                                      : selectedPoints.includes(point)
                                        ? "green" // Selected dot is green
                                        : previousDot === point
                                          ? "yellow" // Previous dot is yellow
                                          : hoveredDotId === point.id
                                            ? "blue" // Hovered dot is blue
                                            : "red" // Default dot color is red
                                  }
                                  draggable
                                  onDragMove={(e) =>
                                    handleDotDragMove(e, ann.id, point.id)
                                  } // Adjust dot position
                                  onClick={(e) =>
                                    handleDotClick(e, point.id, ann.id)
                                  }
                                  onMouseEnter={() => setHoveredDotId(point.id)}
                                  onMouseLeave={() => setHoveredDotId(null)}
                                  onContextMenu={(e) =>
                                    boundingBoxSelectedDots.includes(point)
                                      ? handleBoundingBoxRightClick(e)
                                      : handleDotRightClick(e, point.id, ann.id)
                                  }
                                  dashEnabled={true}
                                />
                                {/* Konva Label for each circle */}
                                {/* <Label x={point.x + 5} y={point.y - 10} 
                                                    // offsetX={point.x} offsetY={point.y}
                                                    > 
                                                        <Tag
                                                            fill="white"
                                                            pointerDirection="down"
                                                            pointerWidth={10}
                                                            pointerHeight={10}
                                                            lineJoin="round"
                                                            shadowColor="black"
                                                            shadowBlur={10}
                                                            shadowOffsetX={10}
                                                            shadowOffsetY={10}
                                                            shadowOpacity={0.5}
                                                        />
                                                        <Text
                                                            text={`Point ${idx + 1}`}  // Customize the label text
                                                            fontSize={12}
                                                            fill="black"
                                                            padding={5}
                                                            name='label'
                                                        />
                                                    </Label> */}
                              </React.Fragment>
                            );
                          })}
                          {obj.lines.map((line, idx) => {
                            const annotation = allVideoAnnotations.find(
                              (Anno) => Anno.id === ann.id
                            ); // Correct this to use the annotation ID
                            const startDot = allVideoAnnotations
                              .find((Anno) => Anno.id === ann.id)
                              ?.frames?.find(
                                (obj) => obj.frame === currentFrame
                              )
                              ?.dots?.find((d) => d.id === line.startDotId);
                            const endDot = allVideoAnnotations
                              .find((Anno) => Anno.id === ann.id)
                              ?.frames?.find(
                                (obj) => obj.frame === currentFrame
                              )
                              ?.dots?.find((d) => d.id === line.endDotId);
                            //   console.log({startDot,endDot,annotation,allVideoAnnotations})
                            if (startDot && endDot) {
                              return (
                                <Line
                                  key={line.id}
                                  points={[
                                    startDot.x,
                                    startDot.y,
                                    endDot.x,
                                    endDot.y,
                                  ]}
                                  stroke={
                                    hoveredLineIndex === line.id
                                      ? "grey"
                                      : "black"
                                  }
                                  strokeWidth={
                                    hoveredLineIndex === line.id ? Math.max(lineStrokeWidth + 2, lineStrokeWidth) : lineStrokeWidth
                                  }
                                  onMouseEnter={() =>
                                    setHoveredLineIndex(line.id)
                                  }
                                  onMouseLeave={() => setHoveredLineIndex(null)}
                                  onClick={() => handleLineClick(line.id)}
                                  onContextMenu={(e) =>
                                    handleLineRightClick(e, line.id, ann.id)
                                  }
                                />
                              );
                            }
                            return null;
                          })}
                          {/* Display a cross symbol on hover to delete the line */}
                          {
                            // deleteLineIndex !== null && deleteLineIndex < currentLines.length && (
                            //     <div onClick={handleDeleteLine}>
                            //         <Text
                            //             text="X"
                            //             fontSize={20}
                            //             fill="red"
                            //             x={(currentLines[deleteLineIndex].start.x + currentLines[deleteLineIndex].end.x) / 2}
                            //             y={(currentLines[deleteLineIndex].start.y + currentLines[deleteLineIndex].end.y) / 2}
                            //             draggable
                            //         />
                            //     </div>
                            // )
                          }
                        </React.Fragment>
                      );
                    })}

                  {isSelecting && (
                    <Rect
                      x={selectionBox.x}
                      y={selectionBox.y}
                      width={selectionBox.width}
                      height={selectionBox.height}
                      fill="rgba(0, 0, 255, 0.3)" // Blue transparent box
                      stroke="blue"
                      strokeWidth={1}
                    />
                  )}
                  {
                    <Label
                      hid
                      x={
                        ann.frames
                          .find((obj) => obj.frame === currentFrame)
                          ?.dots?.at(0)?.x
                      }
                      y={
                        ann.frames
                          .find((obj) => obj.frame === currentFrame)
                          ?.dots?.at(0)?.y
                      }
                      // offsetX={point.x} offsetY={point.y}
                      visible={ann.label !== ""}
                    >
                      <Tag
                        fill="white"
                        pointerDirection="down"
                        pointerWidth={10}
                        pointerHeight={10}
                        lineJoin="round"
                        shadowColor="black"
                        shadowBlur={10}
                        shadowOffsetX={10}
                        shadowOffsetY={10}
                        shadowOpacity={0.5}
                      />
                      <Text
                        text={ann.label} // Customize the label text
                        fontSize={12}
                        fill="black"
                        padding={5}
                      />
                    </Label>
                  }
                </React.Fragment>
              );
            })}
          </Layer>
        </Stage>
        {/* Delete Popup for dot*/}
        {showPopup && (
          <DeletePopup
            x={popupPosition.x}
            y={popupPosition.y}
            onDelete={handleDeleteDot}
            scenario="deleteSingledot"
            onClose={() => setShowPopup(false)}
          />
        )}
          </div>
          
          {/* Video Controls - Play/Pause and Progress Bar */}
          <div style={{ marginTop: 8, width: '800px', display: 'flex', gap: 8, alignItems: 'center' }}>
            <Button variant="contained" size="small" onClick={handlePlayPause}>
              {isPlaying ? 'Pause' : 'Play'}
            </Button>
            <input
              type="range"
              min="0"
              max={duration}
              step="0.01"
              value={currentTime}
              onChange={handleSeek}
              style={{ flex: 1, minWidth: 200 }}
            />
            <span style={{ fontSize: 12, minWidth: 80 }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          
          {/* File Upload */}
          <div style={{ marginTop: 8 }}>
            <input type="file" accept="video/*" onChange={handleUploadVideo} />
          </div>
          
          {/* Toolbar */}
          <div style={{ marginTop: 8, width: '800px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#333', minWidth: 28 }}>FPS</span>
              <input type="number" min={1} value={fps} onChange={(e)=> setFps(parseInt(e.target.value)||1)} style={{ width: 64 }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, color: '#333', minWidth: 56, fontWeight: 500 }}>Dot size</span>
              <input type="range" min={2} max={12} step={1} value={dotRadius} onChange={(e)=> setDotRadius(parseInt(e.target.value)||3)} style={{ width: 140 }} />
              <span style={{ width: 24, textAlign: 'right', fontSize: 14, fontWeight: 500 }}>{dotRadius}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, color: '#333', minWidth: 64, fontWeight: 500 }}>Line width</span>
              <input type="range" min={1} max={8} step={1} value={lineStrokeWidth} onChange={(e)=> setLineStrokeWidth(parseInt(e.target.value)||2)} style={{ width: 140 }} />
              <span style={{ width: 24, textAlign: 'right', fontSize: 14, fontWeight: 500 }}>{lineStrokeWidth}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#333', minWidth: 60 }}>Template</span>
              <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} style={{ width: 120 }}>
                <option value="">Select template</option>
                {SKELETON_TEMPLATES.map(template => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
              <Button variant="outlined" size="small" onClick={handleApplySkeletonTemplate} disabled={!selectedTemplate}>
                Apply
              </Button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={handleUndo} 
                disabled={!undoRedoInfo.canUndo}
                title={`Undo: ${undoRedoInfo.currentAction} (Ctrl+Z)`}
              >
                ↶ Undo
              </Button>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={handleRedo} 
                disabled={!undoRedoInfo.canRedo}
                title="Redo (Ctrl+Y)"
              >
                ↷ Redo
              </Button>
            </div>

            <Button variant="outlined" size="small" onClick={handleDownloadDotsCsv}>Download Dots CSV</Button>
            <Button variant="outlined" size="small" onClick={handleDownloadLinesCsv}>Download Lines CSV</Button>
          </div>

          <div style={{ display: "flex", padding: "1rem", marginTop: "1rem", alignItems: 'center', gap: 8 }}>
            Current Frame: &nbsp;
            <input
              type="number"
              min={1}
              max={totalFrames}
              value={currentFrame}
              onChange={(e) => onChangeFrameNumber(e)}
            />
            <Button variant="text" onClick={handleLoadPrevAnnotations}>Populate last annotations</Button>
          </div>
        </div>

        <div style={{ padding: "1rem", width: 400 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Annotations in current frame:</div>
          {allVideoAnnotations
            .filter((ann) =>
              ann.frames.some((frameObj) => frameObj.frame === currentFrame)
            )
            .map((annotation) => {
              return (
                <Card
                  key={annotation.id}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    margin: "4px 0",
                    display: "flex",
                  }}
                >
                  <TextField
                    label="label"
                    value={annotation.label}
                    style={{ minHeight: "1rem" }}
                    onChange={(e) =>
                      onChangeAnnLabel(e.target.value, annotation.id)
                    }
                  />
                  <IconButton
                    style={{ marginLeft: "auto" }}
                    onClick={() => onDeleteaAnnotation(annotation.id)}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Card>
              );
            })}
        </div>
      </div>
      
      {/* Delete Popup for Line */}
      {showLinePopup && (
        <DeletePopup
          x={popupLinePosition.x}
          y={popupLinePosition.y}
          onDelete={handleDeleteLine}
          scenario="deleteSingleLine"
          onClose={() => setShowLinePopup(false)}
        />
      )}
      {/* Delete Popup for selected dots */}
      {showDeleteAllPopup && (
        <DeletePopup
          x={popupPosition.x}
          y={popupPosition.y}
          onDelete={handleDeleteAllSelectedDots}
          scenario="deletAllDots"
          onClose={() => setShowDeleteAllPopup(false)}
        />
      )}
    </>
  );
};

export default VideoAnnotations2;
