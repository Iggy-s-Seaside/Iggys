import { useState } from 'react';

export default function useForm(inputs = {}) {
    const [formState, setFormState] = useState({ ...inputs });
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormState((prevState) => {
            console.log(prevState);
            return {
                ...prevState,
                [name]: value,
            };
        });
    };
    const resetForm = () => {
        setFormState({ ...inputs });
    };
    return {
        formState,
        handleChange,
        resetForm,
    };
}
