import NotFoundImg from '../assets/images/not_found.png';
import Pill from '../components/ui/Pill';

import { Link } from 'react-router-dom';

const NotFoundPage = ({ query, suggestedWords = [] }) => {
    return (
        <div className='font-body flex justify-center items-center gap-2xl h-[70dvh]'>
            <img src={NotFoundImg} className='w-100 h-100' />


            <div className='flex flex-col gap-xl'>
                <div>
                    <h1 className='text-h1'>No results for "{query}"</h1>
                    <p className='text-body-lg'>We couldn't find a dictionary entry for this word.</p>
                </div>

                {suggestedWords?.length && (
                    <div className='flex flex-col gap-md'>
                        <p className='text-body'>Did you mean:</p>
                        <div className='flex gap-md'>
                            {suggestedWords?.length && (
                                suggestedWords
                                    .slice(0, 4)
                                    .map((suggestion, index) => {
                                        return (
                                            <Link key={index} to={`/${encodeURIComponent(suggestion)}`}>
                                                <Pill className='transition-colors duration-200 ease-in-out hover:bg-primary hover:text-secondary'>{suggestion}</Pill>
                                            </Link>)
                                    })
                            )}
                        </div>
                    </div>
                )}

                <div className='flex flex-col gap-md text-body'>
                    <p>Check the spelling or try another search.</p>
                    <Link to="/" className='underline'>Back to search</Link>
                </div>


            </div>
        </div>
    )
}

export default NotFoundPage