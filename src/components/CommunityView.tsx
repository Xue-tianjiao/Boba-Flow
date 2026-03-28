import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Send, Plus, X, Image as ImageIcon } from 'lucide-react';
import { api } from '../services/api';

interface Post {
  id: number;
  user_name: string;
  user_avatar: string;
  content: string;
  image_url: string;
  like_count: number;
  comment_count: number;
  created_at: string;
}

interface Comment {
  id: number;
  user_name: string;
  content: string;
  created_at: string;
}

export default function CommunityView() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostImage, setNewPostImage] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const data = await api.getPosts();
      setPosts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && !newPostImage) return;
    
    setIsSubmitting(true);

    try {
        await api.createPost({
            userId: "user_1", // Mock user
            userName: "Felix", // Mock user
            userAvatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=Felix",
            content: newPostContent,
            imageUrl: newPostImage || ""
        });
        
        // Reset state
        setNewPostContent("");
        setNewPostImage(null);
        setShowCreate(false);
        
        // Fetch in background
        fetchPosts();
    } catch (e) {
        console.error(e);
        alert("Failed to post. Please try again.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          // Limit image size to 800px max width/height to prevent huge payloads
          const reader = new FileReader();
          reader.onload = (event) => {
              const img = new Image();
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  const MAX_SIZE = 800;

                  if (width > height) {
                      if (width > MAX_SIZE) {
                          height *= MAX_SIZE / width;
                          width = MAX_SIZE;
                      }
                  } else {
                      if (height > MAX_SIZE) {
                          width *= MAX_SIZE / height;
                          height = MAX_SIZE;
                      }
                  }

                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  
                  // Compress to JPEG 0.7
                  setNewPostImage(canvas.toDataURL('image/jpeg', 0.7));
              };
              img.src = event.target?.result as string;
          };
          reader.readAsDataURL(file);
      }
  };

  return (
    <div className="relative min-h-full">
      {/* Feed */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 pb-20">
        <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold tracking-tight">Community</h2>
            <button 
                onClick={() => setShowCreate(true)}
                className="p-2 bg-black text-white rounded-full shadow-lg hover:scale-105 transition-transform"
            >
                <Plus size={24} />
            </button>
        </div>

        {loading && posts.length === 0 ? (
            <div className="text-center py-10 text-gray-500">Loading feeds...</div>
        ) : (
            posts.map(post => (
                <PostCard key={post.id} post={post} />
            ))
        )}
      </motion.div>

      {/* Create Post Modal */}
      {showCreate && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 backdrop-blur-sm">
              <motion.div 
                initial={{ y: 100, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl"
              >
                  <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-lg">New Post</h3>
                      <button onClick={() => setShowCreate(false)} className="p-1 rounded-full hover:bg-gray-100">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <textarea 
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                    placeholder="Share your drink moment..."
                    className="w-full h-32 bg-gray-50 rounded-xl p-4 resize-none outline-none focus:ring-2 focus:ring-black/5"
                  />

                  {newPostImage && (
                      <div className="relative mt-4 rounded-xl overflow-hidden h-40">
                          <img src={newPostImage} className="w-full h-full object-cover" />
                          <button 
                            onClick={() => setNewPostImage(null)}
                            className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded-full"
                          >
                              <X size={16} />
                          </button>
                      </div>
                  )}

                  <div className="flex justify-between items-center mt-4">
                      <div className="relative">
                          <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                          <button className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
                              <ImageIcon size={24} />
                          </button>
                      </div>
                      <button 
                        onClick={handleCreatePost}
                        className="bg-black text-white px-6 py-2 rounded-full font-medium shadow-md disabled:opacity-50 flex items-center gap-2"
                        disabled={(!newPostContent && !newPostImage) || isSubmitting}
                      >
                          {isSubmitting ? 'Posting...' : 'Post'}
                      </button>
                  </div>
              </motion.div>
          </div>
      )}
    </div>
  );
}

function PostCard({ post }: { post: Post }) {
    const [liked, setLiked] = useState(false);
    const [likeCount, setLikeCount] = useState(post.like_count);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<Comment[]>([]);
    const [newComment, setNewComment] = useState("");

    const handleLike = async () => {
        if (liked) return; // Simple implementation: only like, no unlike for now in UI logic
        try {
            await api.likePost(post.id);
            setLiked(true);
            setLikeCount(c => c + 1);
        } catch (e) {
            console.error(e);
        }
    };

    const loadComments = async () => {
        if (showComments) {
            setShowComments(false);
            return;
        }
        try {
            const data = await api.getComments(post.id);
            setComments(data);
            setShowComments(true);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSendComment = async () => {
        if (!newComment.trim()) return;
        try {
            await api.commentPost(post.id, newComment);
            setNewComment("");
            const data = await api.getComments(post.id);
            setComments(data);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-4">
            {/* Header */}
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden">
                    <img src={post.user_avatar || `https://api.dicebear.com/9.x/avataaars/svg?seed=${post.user_name}`} />
                </div>
                <div>
                    <div className="font-bold text-sm">{post.user_name}</div>
                    <div className="text-[10px] text-gray-400">
                        {(() => {
                            try {
                                const d = new Date(post.created_at);
                                return isNaN(d.getTime()) ? 'Just now' : d.toLocaleDateString();
                            } catch { return 'Just now'; }
                        })()}
                    </div>
                </div>
            </div>

            {/* Content */}
            <p className="text-gray-800 text-sm mb-3 leading-relaxed">{post.content}</p>
            {post.image_url && (
                <div className="rounded-2xl overflow-hidden mb-4">
                    <img src={post.image_url} className="w-full object-cover max-h-96" />
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-6">
                <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm ${liked ? 'text-red-500' : 'text-gray-500'}`}>
                    <Heart size={20} fill={liked ? "currentColor" : "none"} />
                    <span>{likeCount}</span>
                </button>
                <button onClick={loadComments} className="flex items-center gap-1.5 text-sm text-gray-500">
                    <MessageCircle size={20} />
                    <span>{comments.length || post.comment_count}</span>
                </button>
            </div>

            {/* Comments Section */}
            <AnimatePresence>
                {showComments && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden mt-4 pt-4 border-t border-gray-50">
                        <div className="space-y-3 mb-4 max-h-40 overflow-y-auto">
                            {comments.map(c => (
                                <div key={c.id} className="text-xs">
                                    <span className="font-bold mr-2">{c.user_name}</span>
                                    <span className="text-gray-600">{c.content}</span>
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input 
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                placeholder="Add a comment..." 
                                className="flex-1 bg-gray-50 rounded-full px-4 py-2 text-xs outline-none focus:ring-1 focus:ring-black/10"
                            />
                            <button onClick={handleSendComment} className="p-2 bg-black text-white rounded-full">
                                <Send size={14} />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
